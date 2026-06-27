---
title: Instantiate
published: 2026-06-27
description: 'Learn OpenGL 第四章第十节'
image: ''
tags: [OpenGL]
category: '学习笔记/OpenGL'
draft: false 
lang: 'zh'
---
# 传统批量渲染的性能瓶颈
传统方式渲染大量物体时，需要多次调用`glDrawArrays` 或 `glDrawElements`。每次绘制调用前，CPU 都需要执行大量准备工作：告知 GPU 读取缓冲位置、配置顶点属性、切换渲染状态等。
这些状态配置、指令传输均通过**速度较慢的 CPU-GPU 总线**完成。而 GPU 属于大规模并行硬件，渲染 1 个顶点和渲染上万个顶点的开销几乎没有区别。因此，场景帧率瓶颈不在于 GPU 绘制顶点，而在于**CPU 频繁调用绘制函数、反复同步渲染状态、反复发送硬件指令**。
**补充说明**：即使两次绘制的 VAO、着色器、纹理、VBO 完全一致，单纯重复调用绘制函数依然会产生巨大性能开销。原因是每次绘制调用都会触发一系列固定开销：CPU 校验全部渲染状态可用性、打包图元参数与顶点范围为硬件指令、总线数据传输、渲染流水线清空与重启、GPU 上下文更新。
# 实例化渲染的核心思想
摒弃多次绘制调用的模式，**仅执行一次绘制函数**，将所有物体数据一次性全部提交给 GPU。由 GPU 按照既定规则批量绘制所有实例物体，彻底规避 CPU 频繁调用绘制接口、同步状态的冗余开销，大幅提升大批量物体渲染性能。
# 实现实例化
## 使用uniform传参
CPU 在渲染循环外一次性向 GPU 提交所有数据，数据分为两类：
- **全局共用数据**：所有实例物体共用的顶点数据、贴图、基础矩阵、着色器代码等
- **实例差异化数据**：区分不同物体的专属数据，可通过在着色器定义 `Uniform` 变量，C++ 侧构造并批量传递给着色器
该方案所有数据仅在渲染循环外传递一次，无需每帧重复传输。但存在明显缺陷：当场景物体数量极大、顶点数据繁多时，所需的 Uniform 变量数量剧增、内存占用过大，会**超出 OpenGL 着色器 Uniform 内存容量限制**，无法满足大规模实例渲染需求。
## 实例化数组方案
为解决 Uniform 内存限制问题，引入**实例化数组**机制，核心区别与原理：
- 普通顶点数组：存储**单个顶点**的专属数据，每渲染一个顶点读取一次数据
- 实例化数组：存储**单个实例**的专属数据（一个实例包含多个顶点），每渲染完成一个实例才读取一次数据
实例化属性本质仍是**标准顶点属性**，仅新增了逐实例刷新标记，必须完整执行 `glVertexAttribPointer` 顶点属性绑定流程，方可正常使用。
# 内建变量 gl_InstanceID
GPU 通过顶点着色器内建变量 **`gl_InstanceID`**，识别当前正在绘制的实例序号。着色器可将该变量作为数组下标，精准读取对应实例的差异化数据，从而实现批量绘制不同状态、不同属性的物体。
# glVertexAttribDivisor 
`glVertexAttribDivisor` 用于控制实例属性的读取频率，确保同一个实例的所有顶点读取到完全相同的差异化数据：
每绘制完成 `divisor `个实例，实例属性的读取游标才会自增一次。在同一个实例的渲染过程中，无论该实例包含多少顶点、渲染多少顶点批次，实例属性读取游标保持不动，所有顶点统一读取当前实例的同一份差异化数据。
单个实例包含的顶点数量，由实例化绘制函数`glDrawArraysInstanced` 指定。
# 矩阵类顶点属性的槽位占用
OpenGL 单个顶点属性槽位（`location`）单次最多仅能传输`vec4` 大小的数据：`vec1`、`vec2`、`vec3`、`vec4` 仅占用 1 个` location `槽位。
对于矩阵类型（如 `mat4`），矩阵的每一列都是独立的 `vec4` 数据，因此一个` mat4 `矩阵会连续占用` 4 `个 `location `槽位。对应需要为矩阵配置` 4 `组独立的顶点属性指针，方可完整读取矩阵数据。

# example1: 使用实例化渲染100个四边形
使用`uniform`数组+`gl_InstanceID`
```c
//main.cpp
#define STB_IMAGE_IMPLEMENTATION
#include <glad/glad.h>
#include <GLFW/glfw3.h>

#include <glm/glm.hpp>
#include <glm/gtc/matrix_transform.hpp>
#include <glm/gtc/type_ptr.hpp>

#include <stb_image.h>
#include <iostream>
#include <vector>

#include <myShader.h>
#include <myCamera.h>
#include <Model.h>

using namespace std;

const unsigned int SCR_WIDTH = 800;
const unsigned int SCR_HEIGHT = 400;

Camera camera(glm::vec3(0.0f, 0.0f, 3.0f));
float lastX = (float)SCR_WIDTH / 2.0f;
float lastY = (float)SCR_HEIGHT / 2.0f;
float deltaTime = 0.0f;
float lastFrame = 0.0f;
bool firstCamera = true;

void framebuffer_size_callback(GLFWwindow* window, int width, int height) {
        glViewport(0, 0, width, height);
}
void processInput(GLFWwindow* window) {
        if(glfwGetKey(window,GLFW_KEY_ESCAPE)==GLFW_PRESS){
                glfwSetWindowShouldClose(window, true);
        }
        if (glfwGetKey(window, GLFW_KEY_W) == GLFW_PRESS) {
                camera.ProcessKeyboard(FORWARD, deltaTime);
        }
        if (glfwGetKey(window, GLFW_KEY_S) == GLFW_PRESS) {
                camera.ProcessKeyboard(BACKWARD, deltaTime);
        }
        if (glfwGetKey(window, GLFW_KEY_A) == GLFW_PRESS) {
                camera.ProcessKeyboard(LEFT, deltaTime);
        }
        if (glfwGetKey(window, GLFW_KEY_D) == GLFW_PRESS) {
                camera.ProcessKeyboard(RIGHT, deltaTime);
        }
}
void processMovement(GLFWwindow* window, double xpos, double ypos) {
        if (firstCamera) {
                lastX = xpos;
                lastY = ypos;
                firstCamera = false;
        }
        float xoffset = xpos - lastX;
        float yoffset = lastY - ypos;
        lastX = xpos;
        lastY = ypos;
        camera.ProcessMouseMovement(xoffset, yoffset);
}
void processScroll(GLFWwindow* window, double xoffset, double yoffset) {
        camera.ProcessScroll(yoffset);
}
unsigned int loadTexture(const char* path) {
        unsigned int texture;
        glGenTextures(1, &texture);
        glBindTexture(GL_TEXTURE_2D, texture);

        int width, height, nrChannels;
        unsigned char* data = stbi_load(path, &width, &height, &nrChannels, 0);
        if (data) {
                GLenum format;
                if (nrChannels == 1) {
                        format = GL_RED;
                }
                else if (nrChannels == 3) {
                        format = GL_RGB;
                }
                else if (nrChannels == 4) {
                        format = GL_RGBA;
                }
                glTexImage2D(GL_TEXTURE_2D, 0, format, width, height, 0, format, GL_UNSIGNED_BYTE, data);
                glGenerateMipmap(GL_TEXTURE_2D);
                glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_REPEAT);
                glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_REPEAT);
                glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR_MIPMAP_LINEAR);
                glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
        }
        else {
                cout << "Failed to load texture" << endl;
        }
        stbi_image_free(data);
        return texture;
}
unsigned int loadCubemap(vector<string> faces) {
        unsigned int texture;
        glGenTextures(1, &texture);
        glBindTexture(GL_TEXTURE_CUBE_MAP, texture);

        int width, height, nrChannels;
        for (int i = 0; i < faces.size(); i++) {
                unsigned char* data = stbi_load(faces[i].c_str(), &width, &height, &nrChannels, 0);
                if(data) {
                        glTexImage2D(GL_TEXTURE_CUBE_MAP_POSITIVE_X + i, 0, GL_RGB, width, height, 0, GL_RGB, GL_UNSIGNED_BYTE, data);
                }
                else {
                        cout << "failed to load cubemap" << endl;
                }
                stbi_image_free(data);
        }
        glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
        glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
        glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_WRAP_R, GL_CLAMP_TO_EDGE);
        glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
        glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);

        return texture;
}
int main() {
        glfwInit();
        glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 3);
        glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 3);
        glfwWindowHint(GLFW_OPENGL_PROFILE, GLFW_OPENGL_CORE_PROFILE);

        GLFWwindow* window = glfwCreateWindow(SCR_WIDTH, SCR_HEIGHT, "LearnOpenGL", NULL, NULL);
        if (window == NULL) {
                cout << "Failed to initialize GLFW" << endl;
                glfwTerminate();
                return -1;
        }
        glfwMakeContextCurrent(window);
        glfwSetFramebufferSizeCallback(window, framebuffer_size_callback);
        glfwSetScrollCallback(window, processScroll);
        glfwSetCursorPosCallback(window, processMovement);

        if (!gladLoadGLLoader((GLADloadproc)glfwGetProcAddress)) {
                cout << "failed to load glad" << endl;
                glfwTerminate();
                return -1;
        }

        glfwSetInputMode(window, GLFW_CURSOR, GLFW_CURSOR_DISABLED);

        //stbi_set_flip_vertically_on_load(true);

        glEnable(GL_DEPTH_TEST);

        float quadVertices[] = {
                // 位置          // 颜色
                -0.05f,  0.05f,  1.0f, 0.0f, 0.0f,
                 0.05f, -0.05f,  0.0f, 1.0f, 0.0f,
                -0.05f, -0.05f,  0.0f, 0.0f, 1.0f,

                -0.05f,  0.05f,  1.0f, 0.0f, 0.0f,
                 0.05f, -0.05f,  0.0f, 1.0f, 0.0f,
                 0.05f,  0.05f,  0.0f, 1.0f, 1.0f
        };

        unsigned int quadVAO, quadVBO;
        glGenVertexArrays(1, &quadVAO);
        glGenBuffers(1, &quadVBO);
        glBindVertexArray(quadVAO);
        glBindBuffer(GL_ARRAY_BUFFER, quadVBO);
        glBufferData(GL_ARRAY_BUFFER, sizeof(quadVertices), quadVertices, GL_STATIC_DRAW);
        glVertexAttribPointer(0, 2, GL_FLOAT, GL_FALSE, 5 * sizeof(float), (void*)0);
        glEnableVertexAttribArray(0);
        glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, 5 * sizeof(float), (void*)(2 * sizeof(float)));
        glEnableVertexAttribArray(1);
        glBindVertexArray(quadVAO);

        Shader shader("src/Shader/vertexShader.txt", "src/Shader/fragmentShader.txt");

        glm::vec2 translations[100];
        int idx = 0;
        float offset = 0.1f;
        for (int y = -10; y < 10; y += 2) {
                for (int x = -10; x < 10; x += 2) {
                        glm::vec2 translation;
                        translation.x = (float)x / 10.0f + offset;
                        translation.y = (float)y / 10.0f + offset;
                        translations[idx++] = translation;
                }
        }
        //给的顶点坐标已经是NDC坐标，范围是-1-1，那么要构造100个四边形，则横向10个纵向10个
        shader.use();
        for (unsigned int i = 0; i < 100; i++) {
                shader.setVec2("offsets[" + to_string(i) + "]", translations[i]);
        }

        while (!glfwWindowShouldClose(window)) {
                float currentFrame = (float)glfwGetTime();
                deltaTime = currentFrame - lastFrame;
                lastFrame = currentFrame;

                processInput(window);

                glClearColor(0.5, 0.5, 0.5, 1.0);
                glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

                shader.use();
                glBindVertexArray(quadVAO);
                glDrawArraysInstanced(GL_TRIANGLES, 0, 6, 100);//单次绘制要处理6个顶点，这6个顶点按三角形模式绘制（3个组成一个三角形），那么1次绘制得到两个三角形构成的四边形。需要绘制100次，则得到了100个四边形

                glfwSwapBuffers(window);
                glfwPollEvents();
        }

        glfwTerminate();
        return 0;
}
```
```glsl
//vertexShader
#version 330 core
layout (location = 0) in vec2 aPos;
layout (location = 1) in vec3 aColor;

out vec3 Color;

uniform vec2 offsets[100];
void main(){
        vec2 offset=offsets[gl_InstanceID];
        gl_Position=vec4(aPos+offset,0.0,1.0);
        Color=aColor;
}
```
```glsl
//fragmentShader
#version 330 core
in vec3 Color;
out vec4 FragColor;
void main(){
        FragColor=vec4(Color,1.0);
}
```
![BQACAgUAAyEGAASHRsPbAAEWLatqP4uzaHd5nFum4R0_98B-ziRCQwACXCcAAk05AVaN90q_0AkBETwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWLatqP4uzaHd5nFum4R0_98B-ziRCQwACXCcAAk05AVaN90q_0AkBETwE.png)

# example2: 使用实例化渲染100个四边形
使用实例化缓冲
将实例差异化数据存为实例化数组，并开启一块新的顶点缓冲，存放实例化数组，设置顶点属性，并使用`glVertexAttribDivisor`设置这块缓冲的读取频率（默认是0，逐顶点；1，2，……分别表示每几个实例读取一次）
在顶点着色器中，设置新的输入变量，接收从实例数组得到的顶点数据（对的，仍然是顶点数据，只是同一实例内所有顶点的这份数据相同），然后可以直接使用而不需要用`gl_InstanceID`索引数组。
```c
//main.cpp
#define STB_IMAGE_IMPLEMENTATION
#include <glad/glad.h>
#include <GLFW/glfw3.h>

#include <glm/glm.hpp>
#include <glm/gtc/matrix_transform.hpp>
#include <glm/gtc/type_ptr.hpp>

#include <stb_image.h>
#include <iostream>
#include <vector>

#include <myShader.h>
#include <myCamera.h>
#include <Model.h>

using namespace std;

const unsigned int SCR_WIDTH = 800;
const unsigned int SCR_HEIGHT = 400;

Camera camera(glm::vec3(0.0f, 0.0f, 3.0f));
float lastX = (float)SCR_WIDTH / 2.0f;
float lastY = (float)SCR_HEIGHT / 2.0f;
float deltaTime = 0.0f;
float lastFrame = 0.0f;
bool firstCamera = true;

void framebuffer_size_callback(GLFWwindow* window, int width, int height) {
        glViewport(0, 0, width, height);
}
void processInput(GLFWwindow* window) {
        if(glfwGetKey(window,GLFW_KEY_ESCAPE)==GLFW_PRESS){
                glfwSetWindowShouldClose(window, true);
        }
        if (glfwGetKey(window, GLFW_KEY_W) == GLFW_PRESS) {
                camera.ProcessKeyboard(FORWARD, deltaTime);
        }
        if (glfwGetKey(window, GLFW_KEY_S) == GLFW_PRESS) {
                camera.ProcessKeyboard(BACKWARD, deltaTime);
        }
        if (glfwGetKey(window, GLFW_KEY_A) == GLFW_PRESS) {
                camera.ProcessKeyboard(LEFT, deltaTime);
        }
        if (glfwGetKey(window, GLFW_KEY_D) == GLFW_PRESS) {
                camera.ProcessKeyboard(RIGHT, deltaTime);
        }
}
void processMovement(GLFWwindow* window, double xpos, double ypos) {
        if (firstCamera) {
                lastX = xpos;
                lastY = ypos;
                firstCamera = false;
        }
        float xoffset = xpos - lastX;
        float yoffset = lastY - ypos;
        lastX = xpos;
        lastY = ypos;
        camera.ProcessMouseMovement(xoffset, yoffset);
}
void processScroll(GLFWwindow* window, double xoffset, double yoffset) {
        camera.ProcessScroll(yoffset);
}
unsigned int loadTexture(const char* path) {
        unsigned int texture;
        glGenTextures(1, &texture);
        glBindTexture(GL_TEXTURE_2D, texture);

        int width, height, nrChannels;
        unsigned char* data = stbi_load(path, &width, &height, &nrChannels, 0);
        if (data) {
                GLenum format;
                if (nrChannels == 1) {
                        format = GL_RED;
                }
                else if (nrChannels == 3) {
                        format = GL_RGB;
                }
                else if (nrChannels == 4) {
                        format = GL_RGBA;
                }
                glTexImage2D(GL_TEXTURE_2D, 0, format, width, height, 0, format, GL_UNSIGNED_BYTE, data);
                glGenerateMipmap(GL_TEXTURE_2D);
                glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_REPEAT);
                glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_REPEAT);
                glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR_MIPMAP_LINEAR);
                glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
        }
        else {
                cout << "Failed to load texture" << endl;
        }
        stbi_image_free(data);
        return texture;
}
unsigned int loadCubemap(vector<string> faces) {
        unsigned int texture;
        glGenTextures(1, &texture);
        glBindTexture(GL_TEXTURE_CUBE_MAP, texture);

        int width, height, nrChannels;
        for (int i = 0; i < faces.size(); i++) {
                unsigned char* data = stbi_load(faces[i].c_str(), &width, &height, &nrChannels, 0);
                if(data) {
                        glTexImage2D(GL_TEXTURE_CUBE_MAP_POSITIVE_X + i, 0, GL_RGB, width, height, 0, GL_RGB, GL_UNSIGNED_BYTE, data);
                }
                else {
                        cout << "failed to load cubemap" << endl;
                }
                stbi_image_free(data);
        }
        glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
        glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
        glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_WRAP_R, GL_CLAMP_TO_EDGE);
        glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
        glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);

        return texture;
}
int main() {
        glfwInit();
        glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 3);
        glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 3);
        glfwWindowHint(GLFW_OPENGL_PROFILE, GLFW_OPENGL_CORE_PROFILE);

        GLFWwindow* window = glfwCreateWindow(SCR_WIDTH, SCR_HEIGHT, "LearnOpenGL", NULL, NULL);
        if (window == NULL) {
                cout << "Failed to initialize GLFW" << endl;
                glfwTerminate();
                return -1;
        }
        glfwMakeContextCurrent(window);
        glfwSetFramebufferSizeCallback(window, framebuffer_size_callback);
        glfwSetScrollCallback(window, processScroll);
        glfwSetCursorPosCallback(window, processMovement);

        if (!gladLoadGLLoader((GLADloadproc)glfwGetProcAddress)) {
                cout << "failed to load glad" << endl;
                glfwTerminate();
                return -1;
        }

        glfwSetInputMode(window, GLFW_CURSOR, GLFW_CURSOR_DISABLED);

        //stbi_set_flip_vertically_on_load(true);

        glEnable(GL_DEPTH_TEST);

        float quadVertices[] = {
                // 位置          // 颜色
                -0.05f,  0.05f,  1.0f, 0.0f, 0.0f,
                 0.05f, -0.05f,  0.0f, 1.0f, 0.0f,
                -0.05f, -0.05f,  0.0f, 0.0f, 1.0f,

                -0.05f,  0.05f,  1.0f, 0.0f, 0.0f,
                 0.05f, -0.05f,  0.0f, 1.0f, 0.0f,
                 0.05f,  0.05f,  0.0f, 1.0f, 1.0f
        };

        glm::vec2 translations[100];//实例属性数组（只存差异化数据）
        int idx = 0;
        float offset = 0.1f;
        for (int y = -10; y < 10; y += 2) {
                for (int x = -10; x < 10; x += 2) {
                        glm::vec2 translation;
                        translation.x = (float)x / 10.0f + offset;
                        translation.y = (float)y / 10.0f + offset;
                        translations[idx++] = translation;
                }
        }

        unsigned int quadVAO, quadVBO;
        glGenVertexArrays(1, &quadVAO);
        glGenBuffers(1, &quadVBO);
        glBindVertexArray(quadVAO);
        glBindBuffer(GL_ARRAY_BUFFER, quadVBO);
        glBufferData(GL_ARRAY_BUFFER, sizeof(quadVertices), quadVertices, GL_STATIC_DRAW);
        glVertexAttribPointer(0, 2, GL_FLOAT, GL_FALSE, 5 * sizeof(float), (void*)0);
        glEnableVertexAttribArray(0);
        //glVertexAttribDivisor(0,0);//对逐顶点更新的顶点数据而言，相当于省略了这一句
        glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, 5 * sizeof(float), (void*)(2 * sizeof(float)));
        glEnableVertexAttribArray(1);
        glBindBuffer(GL_ARRAY_BUFFER, 0);
        glBindVertexArray(0);

        //为实例化数据单独开辟顶点缓冲
        unsigned int instanceVBO;
        glGenBuffers(1, &instanceVBO);
        glBindVertexArray(quadVAO);
        glBindBuffer(GL_ARRAY_BUFFER, instanceVBO);
        glBufferData(GL_ARRAY_BUFFER, sizeof(glm::vec2) * 100, &translations[0], GL_STATIC_DRAW);//第三个参数是首元素地址，在固定大小的数组中，数组名也可以作为首元素地址
        glVertexAttribPointer(2, 2, GL_FLOAT, GL_FALSE, 2 * sizeof(float), (void*)0);
        //stride和offset只针对当前绑定的这块缓冲
        //attribIndex对应着色器中的location
        glEnableVertexAttribArray(2);
        glVertexAttribDivisor(2, 1);//每1个实例更新一次2号属性的内容
        glBindBuffer(GL_ARRAY_BUFFER, 0);
        glBindVertexArray(0);
        
        Shader shader("src/Shader/vertexShader.txt", "src/Shader/fragmentShader.txt");

        while (!glfwWindowShouldClose(window)) {
                float currentFrame = (float)glfwGetTime();
                deltaTime = currentFrame - lastFrame;
                lastFrame = currentFrame;

                processInput(window);

                glClearColor(0.5, 0.5, 0.5, 1.0);
                glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

                shader.use();
                glBindVertexArray(quadVAO);
                glDrawArraysInstanced(GL_TRIANGLES, 0, 6, 100);
                glBindVertexArray(0);

                glfwSwapBuffers(window);
                glfwPollEvents();
        }

        glfwTerminate();
        return 0;
}
```
```glsl
//vertexShader
#version 330 core
layout (location = 0) in vec2 aPos;
layout (location = 1) in vec3 aColor;
layout (location = 2) in vec2 aOffset;
//实例化属性也是顶点属性的一种，只是读取频率不一样，所以为了能够在顶点着色器中使用，也需要在顶部声明

out vec3 Color;

void main(){
        gl_Position=vec4(aPos+aOffset,0.0,1.0);
        Color=aColor;
}
```
```glsl
//fragmentShader
#version 330 core
in vec3 Color;
out vec4 FragColor;
void main(){
        FragColor=vec4(Color,1.0);
}
```
![BQACAgUAAyEGAASHRsPbAAEWLbZqP4wTObyGceEv0S_x4-qbfk-T0QACZycAAk05AVayXEgpSkfxfTwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWLbZqP4wTObyGceEv0S_x4-qbfk-T0QACZycAAk05AVayXEgpSkfxfTwE.png)

# example3: 在实例化数组实现渲染100个四边形的基础上，引入gl_InstanceID
`gl_InstanceID`由GPU内部在每画一个新实例之后自增，代表当前正在画第几个实例。引入`gl_InstanceID`可以在不同实例间引入一些变化
```glsl
//vertexShader
#version 330 core
layout (location = 0) in vec2 aPos;
layout (location = 1) in vec3 aColor;
layout (location = 2) in vec2 aOffset;
//实例化属性也是顶点属性的一种，只是读取频率不一样，所以为了能够在顶点着色器中使用，也需要在顶部声明

out vec3 Color;

void main(){
        vec2 pos=aPos*(gl_InstanceID/100.0);
        //ID=0代表左上角的实例，ID=100代表右下角的实例，ID越大，scale越大，但都是0-1，也就是减小aPos
        gl_Position=vec4(pos+aOffset,0.0,1.0);
        Color=aColor;
}
```
![BQACAgUAAyEGAASHRsPbAAEWLb5qP4xM3cBjTW3rI-JNKVnWCaG2iwACbycAAk05AVb2-bliJ6oL1zwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWLb5qP4xM3cBjTW3rI-JNKVnWCaG2iwACbycAAk05AVb2-bliJ6oL1zwE.png)

# example4: 小行星带
使用传统绘制方式绘制一个行星以及它周围一圈小行星。首先构造小行星的变换矩阵数组，确保每个小行星应用不同的变换，引入随机性。然后在渲染循环中，首先绘制行星，然后绘制小行星，这通过多次调用`glDrawArrays`实现。
```c
//main.cpp
#define STB_IMAGE_IMPLEMENTATION
#include <glad/glad.h>
#include <GLFW/glfw3.h>

#include <glm/glm.hpp>
#include <glm/gtc/matrix_transform.hpp>
#include <glm/gtc/type_ptr.hpp>

#include <stb_image.h>
#include <iostream>
#include <vector>

#include <myShader.h>
#include <myCamera.h>
#include <Model.h>

using namespace std;

const unsigned int SCR_WIDTH = 800;
const unsigned int SCR_HEIGHT = 400;

Camera camera(glm::vec3(0.0f, 0.0f, 3.0f));
float lastX = (float)SCR_WIDTH / 2.0f;
float lastY = (float)SCR_HEIGHT / 2.0f;
float deltaTime = 0.0f;
float lastFrame = 0.0f;
bool firstCamera = true;

void framebuffer_size_callback(GLFWwindow* window, int width, int height) {
        glViewport(0, 0, width, height);
}
void processInput(GLFWwindow* window) {
        if(glfwGetKey(window,GLFW_KEY_ESCAPE)==GLFW_PRESS){
                glfwSetWindowShouldClose(window, true);
        }
        if (glfwGetKey(window, GLFW_KEY_W) == GLFW_PRESS) {
                camera.ProcessKeyboard(FORWARD, deltaTime);
        }
        if (glfwGetKey(window, GLFW_KEY_S) == GLFW_PRESS) {
                camera.ProcessKeyboard(BACKWARD, deltaTime);
        }
        if (glfwGetKey(window, GLFW_KEY_A) == GLFW_PRESS) {
                camera.ProcessKeyboard(LEFT, deltaTime);
        }
        if (glfwGetKey(window, GLFW_KEY_D) == GLFW_PRESS) {
                camera.ProcessKeyboard(RIGHT, deltaTime);
        }
}
void processMovement(GLFWwindow* window, double xpos, double ypos) {
        if (firstCamera) {
                lastX = xpos;
                lastY = ypos;
                firstCamera = false;
        }
        float xoffset = xpos - lastX;
        float yoffset = lastY - ypos;
        lastX = xpos;
        lastY = ypos;
        camera.ProcessMouseMovement(xoffset, yoffset);
}
void processScroll(GLFWwindow* window, double xoffset, double yoffset) {
        camera.ProcessScroll(yoffset);
}
unsigned int loadTexture(const char* path) {
        unsigned int texture;
        glGenTextures(1, &texture);
        glBindTexture(GL_TEXTURE_2D, texture);

        int width, height, nrChannels;
        unsigned char* data = stbi_load(path, &width, &height, &nrChannels, 0);
        if (data) {
                GLenum format;
                if (nrChannels == 1) {
                        format = GL_RED;
                }
                else if (nrChannels == 3) {
                        format = GL_RGB;
                }
                else if (nrChannels == 4) {
                        format = GL_RGBA;
                }
                glTexImage2D(GL_TEXTURE_2D, 0, format, width, height, 0, format, GL_UNSIGNED_BYTE, data);
                glGenerateMipmap(GL_TEXTURE_2D);
                glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_REPEAT);
                glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_REPEAT);
                glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR_MIPMAP_LINEAR);
                glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
        }
        else {
                cout << "Failed to load texture" << endl;
        }
        stbi_image_free(data);
        return texture;
}
unsigned int loadCubemap(vector<string> faces) {
        unsigned int texture;
        glGenTextures(1, &texture);
        glBindTexture(GL_TEXTURE_CUBE_MAP, texture);

        int width, height, nrChannels;
        for (int i = 0; i < faces.size(); i++) {
                unsigned char* data = stbi_load(faces[i].c_str(), &width, &height, &nrChannels, 0);
                if(data) {
                        glTexImage2D(GL_TEXTURE_CUBE_MAP_POSITIVE_X + i, 0, GL_RGB, width, height, 0, GL_RGB, GL_UNSIGNED_BYTE, data);
                }
                else {
                        cout << "failed to load cubemap" << endl;
                }
                stbi_image_free(data);
        }
        glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
        glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
        glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_WRAP_R, GL_CLAMP_TO_EDGE);
        glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
        glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);

        return texture;
}
int main() {
        glfwInit();
        glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 3);
        glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 3);
        glfwWindowHint(GLFW_OPENGL_PROFILE, GLFW_OPENGL_CORE_PROFILE);

        GLFWwindow* window = glfwCreateWindow(SCR_WIDTH, SCR_HEIGHT, "LearnOpenGL", NULL, NULL);
        if (window == NULL) {
                cout << "Failed to initialize GLFW" << endl;
                glfwTerminate();
                return -1;
        }
        glfwMakeContextCurrent(window);
        glfwSetFramebufferSizeCallback(window, framebuffer_size_callback);
        glfwSetScrollCallback(window, processScroll);
        glfwSetCursorPosCallback(window, processMovement);

        if (!gladLoadGLLoader((GLADloadproc)glfwGetProcAddress)) {
                cout << "failed to load glad" << endl;
                glfwTerminate();
                return -1;
        }

        glfwSetInputMode(window, GLFW_CURSOR, GLFW_CURSOR_DISABLED);

        //stbi_set_flip_vertically_on_load(true);

        glEnable(GL_DEPTH_TEST);

        unsigned int amount = 1000;
        glm::mat4* modelMatrices;
        modelMatrices = new glm::mat4[amount];
        srand(glfwGetTime()); // 初始化随机种子    
        float radius = 50.0;
        float offset = 2.5f;
        for (unsigned int i = 0; i < amount; i++)
        {
                glm::mat4 model;
                // 1. 位移：分布在半径为 'radius' 的圆形上（圆心是(0,0))，偏移的范围是 [-offset, offset]
                float angle = (float)i / (float)amount * 360.0f;//把0-360度均分给1000个小行星
                //在每次生成x/y/z坐标之前都做一次随机，保证三轴的偏移不同
                float displacement = (rand() % (int)(2 * offset * 100)) / 100.0f - offset;//生成[-2.5,2.5]的随机偏移
                //rand()%n->0-n-1的整数，如果不引入100，则生成的随机数最多只有1位小数，间隔大，变换生硬；引入100可以得到0.01精度的细腻随机数
                float x = sin(angle) * radius + displacement;
                displacement = (rand() % (int)(2 * offset * 100)) / 100.0f - offset;
                float y = displacement * 0.4f; // 让行星带的高度比x和z的宽度要小
                displacement = (rand() % (int)(2 * offset * 100)) / 100.0f - offset;
                float z = cos(angle) * radius + displacement;
                model = glm::translate(model, glm::vec3(x, y, z));

                // 2. 缩放：在 0.05 和 0.25f 之间缩放
                float scale = (rand() % 20) / 100.0f + 0.05;
                model = glm::scale(model, glm::vec3(scale));

                // 3. 旋转：绕着一个（半）随机选择的旋转轴向量进行随机的旋转
                float rotAngle = (rand() % 360);//生成0-359的随机旋转角度
                model = glm::rotate(model, rotAngle, glm::vec3(0.4f, 0.6f, 0.8f));

                // 4. 添加到矩阵的数组中
                modelMatrices[i] = model;
        }
        
        Shader shader("src/Shader/vertexShader.txt", "src/Shader/fragmentShader.txt");

        Model planet("resources/objects/planet/planet.obj");
        Model rock("resources/objects/rock/rock.obj");

        while (!glfwWindowShouldClose(window)) {
                float currentFrame = (float)glfwGetTime();
                deltaTime = currentFrame - lastFrame;
                lastFrame = currentFrame;

                processInput(window);

                glClearColor(0.5, 0.5, 0.5, 1.0);
                glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

                shader.use();
                glm::mat4 model;
                model = glm::translate(model, glm::vec3(0.0f, -3.0f, 0.0f));
                model = glm::scale(model, glm::vec3(4.0f, 4.0f, 4.0f));
                shader.setMat4("model", model);
                glm::mat4 view;
                view = camera.GetCameraView();
                shader.setMat4("view", view);
                glm::mat4 projection;
                projection = glm::perspective(glm::radians(camera.Zoom), (float)SCR_WIDTH / (float)SCR_HEIGHT, 1.0f, 100.0f);
                shader.setMat4("projection", projection);
                planet.Draw(shader);

                for (unsigned int i = 0; i < amount; i++) {
                        shader.setMat4("model", modelMatrices[i]);
                        shader.setMat4("view", view);
                        shader.setMat4("projection", projection);
                        rock.Draw(shader);
                }

                glfwSwapBuffers(window);
                glfwPollEvents();
        }

        glfwTerminate();
        return 0;
}
```
```glsl
//vertexShader
#version 330 core
layout (location = 0) in vec3 aPos;
layout (location = 2) in vec2 aTexCoords;

out vec2 TexCoords;

uniform mat4 model;
uniform mat4 view;
uniform mat4 projection;

void main(){
        gl_Position=projection*view*model*vec4(aPos,1.0);
        TexCoords=aTexCoords;
}
```
```glsl
//fragmentShader
#version 330 core
struct Material{
        sampler2D texture_diffuse1;
};
uniform Material material;
in vec2 TexCoords;
out vec4 FragColor;
void main(){
        FragColor=texture(material.texture_diffuse1,TexCoords);
}
```
![BQACAgUAAyEGAASHRsPbAAEWLdtqP43W4ud50euYjzlPuLBgBcoh8wACjScAAk05AVbsSAl_TpJGnDwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWLdtqP43W4ud50euYjzlPuLBgBcoh8wACjScAAk05AVbsSAl_TpJGnDwE.png)
这个场景每帧包含1001次绘制，其中1000个用于绘制小行星（岩石模型），当增加小行星的数量，场景变得移动缓慢。

# example5: 使用实例化渲染小行星场景
创建新的顶点缓冲对象，存储每个岩石的变换矩阵。将新定义的VBO绑定到实例的VAO，更新顶点属性指针，并在顶点着色器中添加这个输入属性。
在这里由于引入了模型，所以VAO和VBO的绑定稍显复杂。我们已经知道对一个模型来说，它由多个网格组成，每个网格都将定义一个自己的VAO用于管理当前网格的顶点VBO和EBO。配置新的实例化VBO到VAO时，需要逐个网格配置，并且实例化数据也属于顶点属性，也需要在顶点着色器声明。
```c
//main.cpp
#define STB_IMAGE_IMPLEMENTATION
#include <glad/glad.h>
#include <GLFW/glfw3.h>

#include <glm/glm.hpp>
#include <glm/gtc/matrix_transform.hpp>
#include <glm/gtc/type_ptr.hpp>

#include <stb_image.h>
#include <iostream>
#include <vector>

#include <myShader.h>
#include <myCamera.h>
#include <Model.h>

using namespace std;

const unsigned int SCR_WIDTH = 800;
const unsigned int SCR_HEIGHT = 400;

Camera camera(glm::vec3(0.0f, 0.0f, 3.0f));
float lastX = (float)SCR_WIDTH / 2.0f;
float lastY = (float)SCR_HEIGHT / 2.0f;
float deltaTime = 0.0f;
float lastFrame = 0.0f;
bool firstCamera = true;

void framebuffer_size_callback(GLFWwindow* window, int width, int height) {
        glViewport(0, 0, width, height);
}
void processInput(GLFWwindow* window) {
        if(glfwGetKey(window,GLFW_KEY_ESCAPE)==GLFW_PRESS){
                glfwSetWindowShouldClose(window, true);
        }
        if (glfwGetKey(window, GLFW_KEY_W) == GLFW_PRESS) {
                camera.ProcessKeyboard(FORWARD, deltaTime);
        }
        if (glfwGetKey(window, GLFW_KEY_S) == GLFW_PRESS) {
                camera.ProcessKeyboard(BACKWARD, deltaTime);
        }
        if (glfwGetKey(window, GLFW_KEY_A) == GLFW_PRESS) {
                camera.ProcessKeyboard(LEFT, deltaTime);
        }
        if (glfwGetKey(window, GLFW_KEY_D) == GLFW_PRESS) {
                camera.ProcessKeyboard(RIGHT, deltaTime);
        }
}
void processMovement(GLFWwindow* window, double xpos, double ypos) {
        if (firstCamera) {
                lastX = xpos;
                lastY = ypos;
                firstCamera = false;
        }
        float xoffset = xpos - lastX;
        float yoffset = lastY - ypos;
        lastX = xpos;
        lastY = ypos;
        camera.ProcessMouseMovement(xoffset, yoffset);
}
void processScroll(GLFWwindow* window, double xoffset, double yoffset) {
        camera.ProcessScroll(yoffset);
}
unsigned int loadTexture(const char* path) {
        unsigned int texture;
        glGenTextures(1, &texture);
        glBindTexture(GL_TEXTURE_2D, texture);

        int width, height, nrChannels;
        unsigned char* data = stbi_load(path, &width, &height, &nrChannels, 0);
        if (data) {
                GLenum format;
                if (nrChannels == 1) {
                        format = GL_RED;
                }
                else if (nrChannels == 3) {
                        format = GL_RGB;
                }
                else if (nrChannels == 4) {
                        format = GL_RGBA;
                }
                glTexImage2D(GL_TEXTURE_2D, 0, format, width, height, 0, format, GL_UNSIGNED_BYTE, data);
                glGenerateMipmap(GL_TEXTURE_2D);
                glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_REPEAT);
                glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_REPEAT);
                glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR_MIPMAP_LINEAR);
                glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
        }
        else {
                cout << "Failed to load texture" << endl;
        }
        stbi_image_free(data);
        return texture;
}
unsigned int loadCubemap(vector<string> faces) {
        unsigned int texture;
        glGenTextures(1, &texture);
        glBindTexture(GL_TEXTURE_CUBE_MAP, texture);

        int width, height, nrChannels;
        for (int i = 0; i < faces.size(); i++) {
                unsigned char* data = stbi_load(faces[i].c_str(), &width, &height, &nrChannels, 0);
                if(data) {
                        glTexImage2D(GL_TEXTURE_CUBE_MAP_POSITIVE_X + i, 0, GL_RGB, width, height, 0, GL_RGB, GL_UNSIGNED_BYTE, data);
                }
                else {
                        cout << "failed to load cubemap" << endl;
                }
                stbi_image_free(data);
        }
        glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
        glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
        glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_WRAP_R, GL_CLAMP_TO_EDGE);
        glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
        glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);

        return texture;
}
int main() {
        glfwInit();
        glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 3);
        glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 3);
        glfwWindowHint(GLFW_OPENGL_PROFILE, GLFW_OPENGL_CORE_PROFILE);

        GLFWwindow* window = glfwCreateWindow(SCR_WIDTH, SCR_HEIGHT, "LearnOpenGL", NULL, NULL);
        if (window == NULL) {
                cout << "Failed to initialize GLFW" << endl;
                glfwTerminate();
                return -1;
        }
        glfwMakeContextCurrent(window);
        glfwSetFramebufferSizeCallback(window, framebuffer_size_callback);
        glfwSetScrollCallback(window, processScroll);
        glfwSetCursorPosCallback(window, processMovement);

        if (!gladLoadGLLoader((GLADloadproc)glfwGetProcAddress)) {
                cout << "failed to load glad" << endl;
                glfwTerminate();
                return -1;
        }

        glfwSetInputMode(window, GLFW_CURSOR, GLFW_CURSOR_DISABLED);

        //stbi_set_flip_vertically_on_load(true);

        glEnable(GL_DEPTH_TEST);

        unsigned int amount = 10000;
        glm::mat4* modelMatrices;
        modelMatrices = new glm::mat4[amount];
        srand(glfwGetTime()); // 初始化随机种子    
        float radius = 50.0;
        float offset = 2.5f;
        for (unsigned int i = 0; i < amount; i++)
        {
                glm::mat4 model;
                // 1. 位移：分布在半径为 'radius' 的圆形上（圆心是(0,0))，偏移的范围是 [-offset, offset]
                float angle = (float)i / (float)amount * 360.0f;//把0-360度均分给1000个小行星
                //在每次生成x/y/z坐标之前都做一次随机，保证三轴的偏移不同
                float displacement = (rand() % (int)(2 * offset * 100)) / 100.0f - offset;//生成[-2.5,2.5]的随机偏移
                //rand()%n->0-n-1的整数，如果不引入100，则生成的随机数最多只有1位小数，间隔大，变换生硬；引入100可以得到0.01精度的细腻随机数
                float x = sin(angle) * radius + displacement;
                displacement = (rand() % (int)(2 * offset * 100)) / 100.0f - offset;
                float y = displacement * 0.4f; // 让行星带的高度比x和z的宽度要小
                displacement = (rand() % (int)(2 * offset * 100)) / 100.0f - offset;
                float z = cos(angle) * radius + displacement;
                model = glm::translate(model, glm::vec3(x, y, z));

                // 2. 缩放：在 0.05 和 0.25f 之间缩放
                float scale = (rand() % 20) / 100.0f + 0.05;
                model = glm::scale(model, glm::vec3(scale));

                // 3. 旋转：绕着一个（半）随机选择的旋转轴向量进行随机的旋转
                float rotAngle = (rand() % 360);//生成0-359的随机旋转角度
                model = glm::rotate(model, rotAngle, glm::vec3(0.4f, 0.6f, 0.8f));

                // 4. 添加到矩阵的数组中
                modelMatrices[i] = model;
        }
        
        Shader shader("src/Shader/vertexShader.txt", "src/Shader/fragmentShader.txt");
        Shader instancedShader("src/Shader/instancedVertexShader.txt", "src/Shader/fragmentShader.txt");

        Model planet("resources/objects/planet/planet.obj");
        Model rock("resources/objects/rock/rock.obj");

        unsigned int rockVBO;
        glGenBuffers(1, &rockVBO);
        glBindBuffer(GL_ARRAY_BUFFER, rockVBO);
        glBufferData(GL_ARRAY_BUFFER, sizeof(glm::mat4) * amount, &modelMatrices[0], GL_STATIC_DRAW);

        for (unsigned int i = 0; i < rock.meshes.size(); i++) {
                unsigned int VAO = rock.meshes[i].VAO;
                glBindVertexArray(VAO);//将Mesh的VAO从私有变量改为了公有变量，让我们能够访问它的顶点数组对象。这并不是最好的解决方案，只是为了配合本小节的一个简单的改动
                glVertexAttribPointer(3, 4, GL_FLOAT, GL_FALSE, 4 * sizeof(glm::vec4), (void*)0);
                glEnableVertexAttribArray(3);
                glVertexAttribDivisor(3, 1);
                glVertexAttribPointer(4, 4, GL_FLOAT, GL_FALSE, 4 * sizeof(glm::vec4), (void*)(sizeof(glm::vec4)));
                glEnableVertexAttribArray(4);
                glVertexAttribDivisor(4, 1);
                glVertexAttribPointer(5, 4, GL_FLOAT, GL_FALSE, 4 * sizeof(glm::vec4), (void*)(2*sizeof(glm::vec4)));
                glEnableVertexAttribArray(5);
                glVertexAttribDivisor(5, 1);
                glVertexAttribPointer(6, 4, GL_FLOAT, GL_FALSE, 4 * sizeof(glm::vec4), (void*)(3*sizeof(glm::vec4)));
                glEnableVertexAttribArray(6);
                glVertexAttribDivisor(6, 1);
                glBindVertexArray(0);
        }

        while (!glfwWindowShouldClose(window)) {
                float currentFrame = (float)glfwGetTime();
                deltaTime = currentFrame - lastFrame;
                lastFrame = currentFrame;

                processInput(window);

                glClearColor(0.1, 0.1, 0.1, 1.0);
                glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

                shader.use();
                glm::mat4 model;
                model = glm::translate(model, glm::vec3(0.0f, -3.0f, 0.0f));
                model = glm::scale(model, glm::vec3(4.0f, 4.0f, 4.0f));
                shader.setMat4("model", model);
                glm::mat4 view;
                view = camera.GetCameraView();
                shader.setMat4("view", view);
                glm::mat4 projection;
                projection = glm::perspective(glm::radians(camera.Zoom), (float)SCR_WIDTH / (float)SCR_HEIGHT, 1.0f, 100.0f);
                shader.setMat4("projection", projection);
                planet.Draw(shader);

                instancedShader.use();
                for (unsigned int i = 0; i < rock.meshes.size(); i++) {
                        glBindVertexArray(rock.meshes[i].VAO);
                        instancedShader.setMat4("view", view);
                        instancedShader.setMat4("projection", projection);
                        glDrawElementsInstanced(GL_TRIANGLES, rock.meshes[i].indices.size(), GL_UNSIGNED_INT, 0, amount);//没有调用模型的Draw绘制是因为Draw内部没有集成实例化逻辑
                        glBindVertexArray(0);
                }

                glfwSwapBuffers(window);
                glfwPollEvents();
        }

        glfwTerminate();
        return 0;
}
```
```glsl
//vertexShader
#version 330 core
layout (location = 0) in vec3 aPos;
layout (location = 2) in vec2 aTexCoords;

out vec2 TexCoords;

uniform mat4 model;
uniform mat4 view;
uniform mat4 projection;

void main(){
        gl_Position=projection*view*model*vec4(aPos,1.0);
        TexCoords=aTexCoords;
}
```
```glsl
//instancedVertexShader
#version 330 core
layout (location = 0) in vec3 aPos;
layout (location = 2) in vec2 aTexCoords;
layout (location = 3) in mat4 instanceMatrix;

out vec2 TexCoords;

uniform mat4 view;
uniform mat4 projection;

void main(){
        gl_Position=projection*view*instanceMatrix*vec4(aPos,1.0);
        TexCoords=aTexCoords;
}
```
```glsl
//fragmentShader
#version 330 core
struct Material{
        sampler2D texture_diffuse1;
};
uniform Material material;
in vec2 TexCoords;
out vec4 FragColor;
void main(){
        FragColor=texture(material.texture_diffuse1,TexCoords);
}
```
![BQACAgUAAyEGAASHRsPbAAEWLelqP45rIMBNMspgusxR-UR25EH7wgACmycAAk05AVbFlgjH3p1cyTwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWLelqP45rIMBNMspgusxR-UR25EH7wgACmycAAk05AVbFlgjH3p1cyTwE.png)
在实例化渲染下，amount即使增加到10万，渲染速度和场景移动流畅度也不会有太大的下降、明显的卡顿。正是出于这个原因，实例化渲染通常会用于渲染草、植被、粒子，以及上面这样的场景，基本上只要场景中有很多重复的形状，都能够使用实例化渲染来提高性能。




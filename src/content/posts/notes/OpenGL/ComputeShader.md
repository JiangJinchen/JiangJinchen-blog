---
title: Compute Shader
published: 2026-06-27
description: 'Learn OpenGL 第四章第九节'
image: ''
tags: [OpenGL]
category: '学习笔记/OpenGL'
draft: false 
lang: 'zh'
---
# 定义
几何着色器位于**顶点着色器之后、片元着色器之前**。接收一个完整图元的所有顶点作为输入，可对图元进行修改、生成、重构，最终输出全新的图元。
# 编写规范
## 输入输出图元声明
### 输入声明
`layout (图元类型) in;`
可选输入图元类型：`points`、`lines`、`lines_adjacency`、`triangles`、`triangles_adjacency`
### 输出声明
`layout (图元类型,max_vertices=xx) out;`
指定着色器输出图元类型，同时限制单次最大输出顶点数量。
可选输出图元类型：`points`、`line_strip`、`triangle_strip`
## 输入规则
内置输入变量 **`gl_in`**：为内置结构体数组，存储当前处理图元的全部顶点数据，结构体包含单个顶点的所有属性。
gl_in 内置成员：`gl_Position`、`gl_PointSize`、`gl_ClipDistance[]`。
顶点着色器自定义输出变量（如 `out vec3 Normal`），在几何着色器中必须以**数组**形式接收，示例：`in vec3 Normal[]`。
输入数组长度随图元类型变化：
- 输入为 points：gl_in 仅包含 `gl_in[0]` 单个元素
- 输入为 triangles：gl_in 包含 `gl_in[0]`、`gl_in[1]`、`gl_in[2] `三个顶点元素
## 输出规则
几何着色器输出分为两类，**无需定义数组**：
- 内置输出变量：`gl_Position`、`gl_PointSize` 等
- 自定义输出变量：直接使用 out 声明，传递至片元着色器，示例：`out vec3 fColor`
## 核心内置函数
- **EmitVertex()**：将当前所有赋值完成的输出变量打包为一个顶点，发送至渲染管线
- **EndPrimitive()**：结束当前图元绘制，可多次调用，单次几何着色器可生成多个全新图元
# 输出图元：三角形带（triangle_strip）原理
三角形带可以用最少顶点连续拼接出一串三角形，共享相邻三角形的边与顶点，大幅消除顶点冗余，提升渲染效率。
## 普通独立三角形（triangles）
绘制 `N` 个独立三角形需要`3*N` 个顶点，所有顶点、边完全不共享，冗余度极高。
## 三角形带（triangle_strip）
拼接规则：前 3 个顶点组成第一个三角形；从第 4 个顶点开始，每新增 1 个顶点，与前两个顶点自动拼接为一个新三角形。
为保证所有三角形面朝向一致，**偶数序号三角形会自动翻转顶点顺序**，统一正反面朝向。
# 几何着色器输入输出特性总结
**输入为数组、输出不为数组：**
- 输入：几何着色器单次调用接收**一整个完整图元**，包含该图元的全部顶点，因此输入数据天然是数组形式。
- 输出：动态流式输出，通过 `EmitVertex()` 逐个生成顶点，通过 `EndPrimitive()` 结束图元，无需静态数组定义，可灵活生成任意数量顶点与图元。
# 几何着色器核心优势与使用场景
几何着色器可在 GPU 硬件层面动态生成简单重复图元，运算速度远快于 CPU 预定义顶点数据，大幅减少显存占用与 CPU-GPU 数据传输开销，是重复简单图形的优质优化方案。
**案例：大规模草丛生成**
**传统方案**
CPU 预计算所有草丛顶点：1000 根草、每根草 3 个三角形顶点，需要手动计算 3000 组顶点位置、颜色数据，存入 VBO 后整体传输至 GPU，数据量大、传输开销高、显存占用高。
**几何着色器方案**
CPU 仅需传入 1000 个点图元（每个点代表一根草的位置），仅 1000 个顶点。GPU 通过几何着色器，根据每个点位动态计算生成单根草的所有顶点，无需 CPU 预计算大批量数据，极大减少数据传输量与显存占用。
# 物体爆破效果
**模型爆破效果实现逻辑：**将模型的每一个三角形面片，沿着自身三角面法向量方向，持续偏移移动，实现物体拆分、炸开的动态爆破效果。

# example1: 使用几何着色器造几个小房子
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

const char* geometryShaderSource = "#version 330 core\n"
"layout (points) in;\n"
"layout (triangle_strip,max_vertices=5) out;\n"
"void build_house(vec4 position){\n"
"        gl_Position=position+vec4(-0.2,-0.2,0.0,0.0);\n"
"        EmitVertex();\n"
"        gl_Position=position+vec4(0.2,-0.2,0.0,0.0);\n"
"        EmitVertex();\n"
"        gl_Position=position+vec4(-0.2,0.2,0.0,0.0);\n"
"        EmitVertex();\n"
"        gl_Position=position+vec4(0.2,0.2,0.0,0.0);\n"
"        EmitVertex();\n"
"        gl_Position=position+vec4(0.0,0.4,0.0,0.0);\n"
"        EmitVertex();\n"
"        EndPrimitive();\n"
"}\n"
"void main(){\n"
"        build_house(gl_in[0].gl_Position);\n"
"}\n\0";

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

        float points[] = {
                -0.5f,  0.5f, // 左上
                 0.5f,  0.5f, // 右上
                 0.5f, -0.5f, // 右下
                -0.5f, -0.5f  // 左下
        };

        unsigned int pointVAO, pointVBO;
        glGenVertexArrays(1, &pointVAO);
        glGenBuffers(1, &pointVBO);
        glBindVertexArray(pointVAO);
        glBindBuffer(GL_ARRAY_BUFFER,pointVBO);
        glBufferData(GL_ARRAY_BUFFER, sizeof(points), points, GL_STATIC_DRAW);
        glVertexAttribPointer(0, 2, GL_FLOAT, GL_FALSE, 2 * sizeof(float), (void*)0);
        glEnableVertexAttribArray(0);
        glBindVertexArray(0);

        Shader shader("src/Shader/vertexShader.txt", "src/Shader/fragmentShader.txt");

        unsigned int geometryShader;
        geometryShader = glCreateShader(GL_GEOMETRY_SHADER);
        glShaderSource(geometryShader, 1, &geometryShaderSource, NULL);
        glCompileShader(geometryShader);
        int success;
        char infoLog[512];
        glGetShaderiv(geometryShader, GL_COMPILE_STATUS, &success);
        if (!success) {
                glGetShaderInfoLog(geometryShader, 512, NULL, infoLog);
                cout << "ERROR::SHADER::GEOMETRY::COMPILATION_FAILED\n" << infoLog << endl;
        }
        glAttachShader(shader.ID, geometryShader);
        glLinkProgram(shader.ID);
        glGetProgramiv(shader.ID, GL_LINK_STATUS, &success);
        if (!success) {
                glGetProgramInfoLog(shader.ID, 512, NULL, infoLog);
                cout << "ERROR::SHADER::LINK_FAILED\n" << infoLog << endl;
        }
        glDeleteShader(geometryShader);
        while (!glfwWindowShouldClose(window)) {
                float currentFrame = (float)glfwGetTime();
                deltaTime = currentFrame - lastFrame;
                lastFrame = currentFrame;

                processInput(window);

                glClearColor(0.1, 0.1, 0.1, 1.0);
                glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

                shader.use();
                glBindVertexArray(pointVAO);
                glDrawArrays(GL_POINTS, 0, 4);

                glfwSwapBuffers(window);
                glfwPollEvents();
        }
        glDeleteVertexArrays(1, &pointVAO);
        glDeleteBuffers(1, &pointVBO);

        glfwTerminate();
        return 0;
}
```
```glsl
//vertexShader
#version 330 core
layout (location = 0) in vec2 aPos;

void main(){
        gl_Position=vec4(aPos.x,aPos.y,0.0,1.0);
}
```
```glsl
//fragmentShader
#version 330 core
out vec4 FragColor;

void main(){
        FragColor=vec4(0.0,1.0,0.0,1.0);
}
```
对以上几何着色器中代码的理解：
**首先是C++侧**，使用`glDrawArrays(GL_POINTS,0,4)`,表示提交图元类型为点，且一共提交了4个图元，OpenGL会逐个处理，对每个图元调用一次顶点着色器->几何着色器->片元着色器。
**接着是几何着色器侧**，因为提交图元类型为点，所以输入图元类型设置为`points`，且每次接收一个图元即一个点，这个图元仅包含一个顶点，那么`gl_in`数组内只有一个元素`gl_in[0]`。着色器代码中针对这一个点的位置坐标，依次进行了5次变换，生成了5个点，并且打包成一个图元。理解打包成的图元：`triangle_strip`会把前三个顶点即左下、右下和左上打包成一个三角形，把第二第三第四个顶点即右下、左上和右上打包成第二个三角形，把第三第四和第五个顶点即左上、右上和顶部打包成第三个三角形，且`opengl`会自动调整顶点顺序保证正向面。这样就得到了一个由三个三角形构成的一个小房子。这个图元会经过光栅化，遍历这 3 个三角形内部所有覆盖的屏幕像素，生成片元，再经片元着色器处理每个片元，输出颜色，把颜色写入帧缓冲，就在屏幕上看到了绿色小房子。每个顶点都执行了上述过程，有4个顶点，则生成了4个小房子。
![BQACAgUAAyEGAASHRsPbAAEWLUtqP4e_8DTM_HHXTIsRnAFaFC5C_QAC9SYAAk05AVZEfV9cv82RCDwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWLUtqP4e_8DTM_HHXTIsRnAFaFC5C_QAC9SYAAk05AVZEfV9cv82RCDwE.png)


# example2: 引入顶点颜色
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

const char* geometryShaderSource = "#version 330 core\n"
"layout (points) in;\n"
"layout (triangle_strip,max_vertices=5) out;\n"
"in VS_OUT{\n"
"        vec3 color;\n"
"} gs_in[];\n"
"out vec3 fColor;\n"
"void build_house(vec4 position){\n"
"        fColor=gs_in[0].color;\n"
"        gl_Position=position+vec4(-0.2,-0.2,0.0,0.0);\n"
"        EmitVertex();\n"
"        gl_Position=position+vec4(0.2,-0.2,0.0,0.0);\n"
"        EmitVertex();\n"
"        gl_Position=position+vec4(-0.2,0.2,0.0,0.0);\n"
"        EmitVertex();\n"
"        gl_Position=position+vec4(0.2,0.2,0.0,0.0);\n"
"        EmitVertex();\n"
"        fColor=vec3(1.0,1.0,1.0);\n"
"        gl_Position=position+vec4(0.0,0.4,0.0,0.0);\n"
"        EmitVertex();\n"
"        EndPrimitive();\n"
"}\n"
"void main(){\n"
"        build_house(gl_in[0].gl_Position);\n"
"}\n\0";

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

        float points[] = {
                -0.5f,  0.5f, 1.0f, 0.0f, 0.0f, // 左上
                 0.5f,  0.5f, 0.0f, 1.0f, 0.0f, // 右上
                 0.5f, -0.5f, 0.0f, 0.0f, 1.0f, // 右下
                -0.5f, -0.5f, 1.0f, 1.0f, 0.0f  // 左下
        };

        unsigned int pointVAO, pointVBO;
        glGenVertexArrays(1, &pointVAO);
        glGenBuffers(1, &pointVBO);
        glBindVertexArray(pointVAO);
        glBindBuffer(GL_ARRAY_BUFFER,pointVBO);
        glBufferData(GL_ARRAY_BUFFER, sizeof(points), points, GL_STATIC_DRAW);
        glVertexAttribPointer(0, 2, GL_FLOAT, GL_FALSE, 5 * sizeof(float), (void*)0);
        glEnableVertexAttribArray(0);
        glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, 5 * sizeof(float), (void*)(2 * sizeof(float)));
        glEnableVertexAttribArray(1);
        glBindVertexArray(0);

        Shader shader("src/Shader/vertexShader.txt", "src/Shader/fragmentShader.txt");

        unsigned int geometryShader;
        geometryShader = glCreateShader(GL_GEOMETRY_SHADER);
        glShaderSource(geometryShader, 1, &geometryShaderSource, NULL);
        glCompileShader(geometryShader);
        int success;
        char infoLog[512];
        glGetShaderiv(geometryShader, GL_COMPILE_STATUS, &success);
        if (!success) {
                glGetShaderInfoLog(geometryShader, 512, NULL, infoLog);
                cout << "ERROR::SHADER::GEOMETRY::COMPILATION_FAILED\n" << infoLog << endl;
        }
        glAttachShader(shader.ID, geometryShader);
        glLinkProgram(shader.ID);
        glGetProgramiv(shader.ID, GL_LINK_STATUS, &success);
        if (!success) {
                glGetProgramInfoLog(shader.ID, 512, NULL, infoLog);
                cout << "ERROR::SHADER::LINK_FAILED\n" << infoLog << endl;
        }
        glDeleteShader(geometryShader);
        while (!glfwWindowShouldClose(window)) {
                float currentFrame = (float)glfwGetTime();
                deltaTime = currentFrame - lastFrame;
                lastFrame = currentFrame;

                processInput(window);

                glClearColor(0.1, 0.1, 0.1, 1.0);
                glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

                shader.use();
                glBindVertexArray(pointVAO);
                glDrawArrays(GL_POINTS, 0, 4);

                glfwSwapBuffers(window);
                glfwPollEvents();
        }
        glDeleteVertexArrays(1, &pointVAO);
        glDeleteBuffers(1, &pointVBO);

        glfwTerminate();
        return 0;
}
```
```glsl
//vertexShader
#version 330 core
layout (location = 0) in vec2 aPos;
layout (location = 1) in vec3 aColor;

out VS_OUT{
        vec3 color;
}vs_out;

void main(){
        gl_Position=vec4(aPos.x,aPos.y,0.0,1.0);
        vs_out.color=aColor;
}
```
```glsl
//fragmentShader
#version 330 core
in vec3 fColor;
out vec4 FragColor;

void main(){
        FragColor=vec4(fColor,1.0);
}
```
在上面的代码中，在**顶点数据数组中**引入了**顶点颜色属性**（即RGB三颜色分量），并更新了顶点属性指针。在顶点着色器中声明了新的输入及它的位置值，声明了新的输出，每个顶点的颜色值将传递到几何着色器。在几何着色器中，使用每个图元的每个顶点的颜色值为新生成的顶点赋值。某个顶点属性的值会保持第一次赋的值直到它被修改。在这里，可以给每个（新生成的）顶点赋相同的值，也可以给每个顶点赋不同的值，所有的顶点将会构成图元作为几何着色器的输出。光栅化过程中会对每个片元涉及的顶点之间进行属性插值来决定一个片元的各个属性值，然后在片元着色器中使用这些属性值进行着色。所以即使几何着色器中每个顶点有不同的属性值（比如顶点1是蓝色，顶点2是红色……），在片元着色器中都只接收到一个片元插值后的一个值（三个顶点颜色之间插值），所以几何着色器的输出不是数组。
![BQACAgUAAyEGAASHRsPbAAEWLU9qP4hOQkRw2c3C6B4jbUXQhmtFjQAC-iYAAk05AVbBUT7XH_Lm2TwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWLU9qP4hOQkRw2c3C6B4jbUXQhmtFjQAC-iYAAk05AVbBUT7XH_Lm2TwE.png)

把创建几何着色器的逻辑添加到myShader.h中：
```c
//myShader.h
#pragma once
#ifndef SHADER_H
#define SHADER_H
//以上预处理指令（包含最后的#endif告知编译器只在这个头文件没被包含过的情况下才包含和编译，防止链接冲突

#include <glad/glad.h>//包含glad来获取所有必须的OpenGL头文件
#include <string>//存储着色器源码
#include <fstream>//用ifstream读取外部文件
#include <sstream>//用stringstream把文件内容转成字符串
#include <iostream>//用cout打印错误信息

using namespace std;

class Shader {
public:
        unsigned int ID;//着色器程序ID。着色器程序将顶点着色器、片元着色器组装起来
        //下面这是着色器构造函数
        Shader(const char* vertexPath, const char* fragmentPath,const char* geometryPath=nullptr) {
                //1.从文件路径中获取顶点/片元着色器
                string vertexCode;//存储顶点着色器源码的字符串对象
                string fragmentCode;
                string geometryCode;
                ifstream vShaderFile;//ifstream对象是一个文件读取对象，用于打开外部着色器文件
                ifstream fShaderFile;
                ifstream gShaderFile;

                //ifstream对象读取失败可抛出异常
                vShaderFile.exceptions(ifstream::failbit | ifstream::badbit);
                fShaderFile.exceptions(ifstream::failbit | ifstream::badbit);
                gShaderFile.exceptions(ifstream::failbit | ifstream::badbit);

                try {
                        //打开文件
                        vShaderFile.open(vertexPath);
                        fShaderFile.open(fragmentPath);
                        stringstream vShaderStream, fShaderStream;//stringstream是字符流对象，相当于一个临时缓冲区，把从文件读到的内容，先存到流里，再转成字符串
                        //读取文件的缓冲内容到数据流中
                        vShaderStream << vShaderFile.rdbuf();
                        fShaderStream << fShaderFile.rdbuf();
                        //关闭文件处理器
                        vShaderFile.close();
                        fShaderFile.close();

                        //转换数据流到string
                        vertexCode = vShaderStream.str();
                        fragmentCode = fShaderStream.str();

                        if (geometryPath != nullptr) {
                                gShaderFile.open(geometryPath);
                                stringstream gShaderStream;
                                gShaderStream << gShaderFile.rdbuf();
                                gShaderFile.close();
                                geometryCode = gShaderStream.str();
                        }
                }
                catch(ifstream::failure e){
                        cout << "ERROR::SHADER::FILE_NOT_SUCCESSFULLY_READ" << endl;
                }
                const char* vShaderCode = vertexCode.c_str();//string是C++字符串，OpenGL只认识C语言的const char*，所以必须用c_str进行数据类型转换
                const char* fShaderCode = fragmentCode.c_str();

                //2.编译和链接着色器
                unsigned int vertex, fragment;
                int success;
                char infoLog[512];
                vertex = glCreateShader(GL_VERTEX_SHADER);
                glShaderSource(vertex, 1, &vShaderCode, NULL);
                glCompileShader(vertex);
                glGetShaderiv(vertex, GL_COMPILE_STATUS, &success);
                if (!success) {
                        glGetShaderInfoLog(vertex, 512, NULL, infoLog);
                        cout << "ERROR::SHADER::VERTEX::COMPILATION_FAILED\n" << endl;
                }

                fragment = glCreateShader(GL_FRAGMENT_SHADER);
                glShaderSource(fragment, 1, &fShaderCode, NULL);
                glCompileShader(fragment);
                glGetShaderiv(fragment, GL_COMPILE_STATUS, &success);
                if (!success) {
                        glGetShaderInfoLog(fragment, 512, NULL, infoLog);
                        cout << "ERROR::SHADER::FRAGMENT::COMPILATION_FAILED\n" << endl;
                }

                unsigned int geometry;
                if (geometryPath != nullptr) {
                        const char* gShaderCode = geometryCode.c_str();
                        geometry = glCreateShader(GL_GEOMETRY_SHADER);
                        glShaderSource(geometry, 1, &gShaderCode, NULL);
                        glCompileShader(geometry);
                        glGetShaderiv(geometry, GL_COMPILE_STATUS, &success);
                        if (!success) {
                                glGetShaderInfoLog(geometry, 512, NULL, infoLog);
                                cout << "ERROR::SHADER::GEOMETRY::COMPILATION_FAILED\n" << endl;
                        }
                }

                //创建着色器程序
                ID = glCreateProgram();
                //链接
                glAttachShader(ID, vertex);
                glAttachShader(ID, fragment);
                if (geometryPath != nullptr) {
                        glAttachShader(ID, geometry);
                }
                glLinkProgram(ID);
                glGetProgramiv(ID, GL_LINK_STATUS, &success);
                if (!success) {
                        glGetProgramInfoLog(ID, 512, NULL, infoLog);
                        cout << "ERROR::SHADER::PROGRAM::LINKING_FAILED\n" << infoLog << endl;
                }
                glDeleteShader(vertex);
                glDeleteShader(fragment);
                if (geometryPath != nullptr) {
                        glDeleteShader(geometry);
                }
        };
        //激活函数
        void use() {
                glUseProgram(ID);
        };
        //uniform工具函数
        //每次设置uniform变量时都需要先获取uniform变量的位置，再设置。以下工具函数把这两行代码抽象为一个函数，可直接调用完成设置
        void setBool(const string& name, bool value) const {
                glUniform1i(glGetUniformLocation(ID, name.c_str()), (int)value);
        };//这里的两个参数分别是uniform变量的名字和要设置的值
        void setInt(const string& name, int value) const {
                glUniform1i(glGetUniformLocation(ID, name.c_str()), value);
        };
        void setFloat(const string& name, float value) const {
                glUniform1f(glGetUniformLocation(ID, name.c_str()), value);
        };
        void setVec2(const string& name, const glm::vec2& value) const
        {
                glUniform2fv(glGetUniformLocation(ID, name.c_str()), 1, &value[0]);
        };
        void setVec2(const string& name, float x, float y) const
        {
                glUniform2f(glGetUniformLocation(ID, name.c_str()), x, y);
        };
        // ------------------------------------------------------------------------
        void setVec3(const string& name, const glm::vec3& value) const
        {
                glUniform3fv(glGetUniformLocation(ID, name.c_str()), 1, &value[0]);
        };
        void setVec3(const string& name, float x, float y, float z) const
        {
                glUniform3f(glGetUniformLocation(ID, name.c_str()), x, y, z);
        };
        // ------------------------------------------------------------------------
        void setVec4(const string& name, const glm::vec4& value) const
        {
                glUniform4fv(glGetUniformLocation(ID, name.c_str()), 1, &value[0]);
        };
        void setVec4(const string& name, float x, float y, float z, float w)
        {
                glUniform4f(glGetUniformLocation(ID, name.c_str()), x, y, z, w);
        };
        void setMat2(const string& name, const glm::mat2& mat) const
        {
                glUniformMatrix2fv(glGetUniformLocation(ID, name.c_str()), 1, GL_FALSE, &mat[0][0]);
        }
        // ------------------------------------------------------------------------
        void setMat3(const string& name, const glm::mat3& mat) const
        {
                glUniformMatrix3fv(glGetUniformLocation(ID, name.c_str()), 1, GL_FALSE, &mat[0][0]);
        }
        void setMat4(const string& name, const glm::mat4 value) const {
                glUniformMatrix4fv(glGetUniformLocation(ID, name.c_str()), 1, GL_FALSE, glm::value_ptr(value));
        };
        void setVec3(const string& name, glm::vec3 value) const {
                glUniform3fv(glGetUniformLocation(ID, name.c_str()), 1, glm::value_ptr(value));
        }
};
#endif
```
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

const char* geometryShaderSource = "#version 330 core\n"
"layout (points) in;\n"
"layout (triangle_strip,max_vertices=5) out;\n"
"in VS_OUT{\n"
"        vec3 color;\n"
"} gs_in[];\n"
"out vec3 fColor;\n"
"void build_house(vec4 position){\n"
"        fColor=gs_in[0].color;\n"
"        gl_Position=position+vec4(-0.2,-0.2,0.0,0.0);\n"
"        EmitVertex();\n"
"        gl_Position=position+vec4(0.2,-0.2,0.0,0.0);\n"
"        EmitVertex();\n"
"        gl_Position=position+vec4(-0.2,0.2,0.0,0.0);\n"
"        EmitVertex();\n"
"        gl_Position=position+vec4(0.2,0.2,0.0,0.0);\n"
"        EmitVertex();\n"
"        fColor=vec3(1.0,1.0,1.0);\n"
"        gl_Position=position+vec4(0.0,0.4,0.0,0.0);\n"
"        EmitVertex();\n"
"        EndPrimitive();\n"
"}\n"
"void main(){\n"
"        build_house(gl_in[0].gl_Position);\n"
"}\n\0";

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

        float points[] = {
                -0.5f,  0.5f, 1.0f, 0.0f, 0.0f, // 左上
                 0.5f,  0.5f, 0.0f, 1.0f, 0.0f, // 右上
                 0.5f, -0.5f, 0.0f, 0.0f, 1.0f, // 右下
                -0.5f, -0.5f, 1.0f, 1.0f, 0.0f  // 左下
        };

        unsigned int pointVAO, pointVBO;
        glGenVertexArrays(1, &pointVAO);
        glGenBuffers(1, &pointVBO);
        glBindVertexArray(pointVAO);
        glBindBuffer(GL_ARRAY_BUFFER,pointVBO);
        glBufferData(GL_ARRAY_BUFFER, sizeof(points), points, GL_STATIC_DRAW);
        glVertexAttribPointer(0, 2, GL_FLOAT, GL_FALSE, 5 * sizeof(float), (void*)0);
        glEnableVertexAttribArray(0);
        glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, 5 * sizeof(float), (void*)(2 * sizeof(float)));
        glEnableVertexAttribArray(1);
        glBindVertexArray(0);

        Shader shader("src/Shader/vertexShader.txt", "src/Shader/fragmentShader.txt","src/Shader/geometryShader.txt");

        while (!glfwWindowShouldClose(window)) {
                float currentFrame = (float)glfwGetTime();
                deltaTime = currentFrame - lastFrame;
                lastFrame = currentFrame;

                processInput(window);

                glClearColor(0.1, 0.1, 0.1, 1.0);
                glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

                shader.use();
                glBindVertexArray(pointVAO);
                glDrawArrays(GL_POINTS, 0, 4);

                glfwSwapBuffers(window);
                glfwPollEvents();
        }
        glDeleteVertexArrays(1, &pointVAO);
        glDeleteBuffers(1, &pointVBO);

        glfwTerminate();
        return 0;
}
```

# example3: 爆炸效果
爆炸指的是把三角形沿着法线向外偏移一段距离。这一逻辑的完成正是在几何着色器。**顶点着色器负责顶点变换以及输出片元着色器采样纹理需要的纹理坐标**。几何着色器以三角形图元为输入，通过三个顶点的位置计算三角形面的法线，再把三个顶点沿着法线偏移一段距离。同时也负责在顶点和片元着色器之间传递纹理坐标。
修改顶点位移这件事，顶点着色器也可以做，但是它只能盲目的选择顶点修改，不知道哪些顶点位于同一个面。而几何着色器可以知道这一点，它拿到的顶点就是属于一个面的所有顶点。
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

        Shader shader("src/Shader/vertexShader.txt", "src/Shader/fragmentShader.txt","src/Shader/geometryShader.txt");

        Model myModel("resources/objects/backpack/backpack.obj");

        while (!glfwWindowShouldClose(window)) {
                float currentFrame = (float)glfwGetTime();
                deltaTime = currentFrame - lastFrame;
                lastFrame = currentFrame;

                processInput(window);

                glClearColor(0.5, 0.5, 0.5, 1.0);
                glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

                shader.use();
                glm::mat4 model;
                model = glm::translate(model, glm::vec3(0.0f));
                model = glm::scale(model, glm::vec3(1.0f));
                shader.setMat4("model", model);
                glm::mat4 view;
                view = camera.GetCameraView();
                shader.setMat4("view", view);
                glm::mat4 projection;
                projection = glm::perspective(glm::radians(45.0f), (float)SCR_WIDTH / (float)SCR_HEIGHT, 1.0f, 100.0f);
                shader.setMat4("projection", projection);
                shader.setFloat("time", static_cast<float>(glfwGetTime()));
                myModel.Draw(shader);

                glfwSwapBuffers(window);
                glfwPollEvents();
        }

        glfwTerminate();
        return 0;
}
```
```glsl
//vertexShader.txt
#version 330 core
layout (location = 0) in vec3 aPos;
layout (location = 2) in vec2 aTexCoords;

out VS_OUT{
        vec2 texCoords;
}vs_out;

uniform mat4 model;
uniform mat4 view;
uniform mat4 projection;
void main(){
        gl_Position=projection*view*model*vec4(aPos,1.0);
        vs_out.texCoords=aTexCoords;
}
```
```glsl
//fragmentShader
#version 330 core
in vec2 TexCoords;
out vec4 FragColor;
struct Material{
        sampler2D texture_diffuse1;
};
uniform Material material;
void main(){
        FragColor=texture(material.texture_diffuse1,TexCoords);
}
```
![BQACAgUAAyEGAASHRsPbAAEWLVVqP4jcWacsST3e2ff8fV-PiCcp7gACAycAAk05AVb1Ml7y1XtoejwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWLVVqP4jcWacsST3e2ff8fV-PiCcp7gACAycAAk05AVb1Ml7y1XtoejwE.png)

# example4: 法线可视化
**使用两个着色器分别绘制模型。**第一个着色器正常绘制，包含顶点和片元着色器，作为底模，也是法线的载体；第二个着色器可视化法线，包含顶点、几何和片元着色器。几何着色器干的就是对每个三角形的每个顶点，沿着法线方向画一条线段。那么几何着色器相当于变换输入输出图元类型了，输入是一个三角形，输出是三条线段。之后片元着色器对这些线段进行着色。由于几何着色器中需要得到每个顶点的法线，所以顶点着色器就是常规的顶点变换+法线变换。这里的法线直接使用了顶点数据中的顶点法线。
比较疑惑的一点是为什么顶点着色器只把位置坐标和法线转换到视图空间，然后几何着色器在视图空间内偏移顶点，最后变换到裁剪空间，再传递给片元着色器。试了一下如果只转换到世界空间效果也没有什么不同。但是如果转换到裁剪空间，效果就不太对了，看起来线段的长度不太均匀，问了下AI说是裁剪空间是经过透视除法的非线性空间，`x/y/z/w` 不再是等比例线性坐标； 在裁剪空间做 `pos + normal` 偏移，线段长度会随距离镜头远近剧烈拉伸/压缩，视觉完全失真。所以偏移、方向类几何运算，只能在线性空间（模型/世界/视图）做。
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

        Shader shader("src/Shader/vertexShader.txt", "src/Shader/fragmentShader.txt");
        Shader normalDisplayShader("src/Shader/normalDisplayVertexShader.txt", "src/Shader/normalDisplayFragmentShader.txt", "src/Shader/geometryShader.txt");

        Model myModel("resources/objects/backpack/backpack.obj");

        while (!glfwWindowShouldClose(window)) {
                float currentFrame = (float)glfwGetTime();
                deltaTime = currentFrame - lastFrame;
                lastFrame = currentFrame;

                processInput(window);

                glClearColor(0.5, 0.5, 0.5, 1.0);
                glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

                shader.use();
                glm::mat4 model;
                model = glm::translate(model, glm::vec3(0.0f));
                model = glm::scale(model, glm::vec3(1.0f));
                shader.setMat4("model", model);
                glm::mat4 view;
                view = camera.GetCameraView();
                shader.setMat4("view", view);
                glm::mat4 projection;
                projection = glm::perspective(glm::radians(45.0f), (float)SCR_WIDTH / (float)SCR_HEIGHT, 1.0f, 100.0f);
                shader.setMat4("projection", projection);
                myModel.Draw(shader);

                normalDisplayShader.use();
                normalDisplayShader.setMat4("model", model);
                normalDisplayShader.setMat4("view", view);
                normalDisplayShader.setMat4("projection", projection);
                myModel.Draw(normalDisplayShader);

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
in vec2 TexCoords;
out vec4 FragColor;
struct Material{
        sampler2D texture_diffuse1;
};
uniform Material material;
void main(){
        FragColor=texture(material.texture_diffuse1,TexCoords);
}
```
```glsl
//normalDisplayVertexShader
#version 330 core
layout (location=0) in vec3 aPos;
layout (location=1) in vec3 aNormal;

out VS_OUT{
        vec3 normal;
}vs_out;

uniform mat4 model;
uniform mat4 view;

void main(){
        gl_Position=view*model*vec4(aPos,1.0);
        vs_out.normal=mat3(transpose(inverse(view*model)))*aNormal;
}
```
```glsl
//normalDisplayFragmentShader
#version 330 core
out vec4 FragColor;
void main(){
        FragColor=vec4(1.0,1.0,0.0,1.0);
}
```
```glsl
//geometryShader
#version 330 core
layout (triangles) in;
layout (line_strip,max_vertices=6) out;
in VS_OUT{
        vec3 normal;
} gs_in[];

const float MAGNITUDE=0.4;

uniform mat4 projection;

void DrawLine(int idx){
        gl_Position=projection*gl_in[idx].gl_Position;
        EmitVertex();
        gl_Position=projection*(gl_in[idx].gl_Position+vec4(gs_in[idx].normal,0.0)*MAGNITUDE);
        EmitVertex();
        EndPrimitive();
}
void main(){
        DrawLine(0);
        DrawLine(1);
        DrawLine(2);
}
```
![BQACAgUAAyEGAASHRsPbAAEWLWFqP4mI1LqLcHNBq1tl6eSC2EoQhwACECcAAk05AVY-zwKpbZr3ETwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWLWFqP4mI1LqLcHNBq1tl6eSC2EoQhwACECcAAk05AVY-zwKpbZr3ETwE.png)
看起来毛茸茸的，所以这种做法也可以用于给物体添加毛发。
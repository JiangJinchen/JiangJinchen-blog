---
title: Advanced GLSL
published: 2026-06-27
description: 'Learn OpenGL 第四章第八节'
image: ''
tags: [OpenGL]
category: '学习笔记/OpenGL'
draft: false 
lang: 'zh'
---
# GLSL 内建变量
内建变量为着色器**无需手动定义、可直接使用**的系统变量，自带固定语义，可理解为系统自动填充或等待管线填充的内置常量/变量。
*示例：*顶点着色器中裁剪空间输出位置向量 `gl_Position`。
# 着色器接口块
接口块用于**规范化组织着色器的输入与输出数据**，实现顶点着色器与片元着色器的数据传递。
## 使用规则
- 顶点着色器：使用 `out` 关键字定义输出接口块
- 片元着色器：使用 `in` 关键字定义输入接口块
- **核心要求**：两端**块名必须完全一致**，块实例对象名无需一致
- 访问块内成员变量时，必须**添加块名作为前缀**
# 普通 Uniform 变量共享规则
## 跨着色器程序
多个独立的**着色器程序**（各自包含一套顶点+片元着色器），即使定义了同名 uniform 变量，**必须分别单独设置**，相互不共享。
## 同着色器程序内部
对于**同一个着色器程序**，若顶点着色器、片元着色器使用了同一个 `uniform` 变量，**只需 CPU 设置一次即可全局共用**。
# Uniform 缓冲对象
**UBO（Uniform Buffer Object）**：类似于 `VBO`，`VBO` 用于存储顶点数据，`UBO` 专门用于存储**多个着色器程序可共享的批量 `Uniform` 变量**。
## 核心工作原理
GPU 预设有若干 UBO 绑定点，通过**绑定点编号对齐**实现数据互通：
1. CPU 侧：将创建好的 UBO 绑定到指定编号的绑定点
2. 着色器侧：Uniform 块声明绑定到**同一编号**的绑定点
3. 编号匹配后，所有关联该绑定点的着色器均可读取同一份 `UBO` 数据
## 着色器端 UBO 声明（OpenGL4.2+）
```glsl
// std140：固定内存对齐规则
// binding=0：绑定至0号UBO绑定点
layout (std140,binding=0) uniform GlobalMatrices{
    mat4 view;
    mat4 project;
};

// 普通独有Uniform，仅属于当前着色器
uniform mat4 model;
```
## C++ 端创建 UBO
```c
unsigned int ubo;
glGenBuffers(1,&ubo);
glBindBuffer(GL_UNIFORM_BUFFER,ubo);
// 开辟对应大小显存，暂不填充数据
glBufferData(GL_UNIFORM_BUFFER,2*sizeof(glm::mat4),NULL,GL_STATIC_DRAW);
glBindBuffer(GL_UNIFORM_BUFFER,0);
```
## C++ 端绑定 UBO 到绑定点
```c
一个 UBO 只需绑定一次，全局生效：
// 方式1：指定偏移与大小，支持一个缓冲区绑定多段UBO
glBindBufferRange(GL_UNIFORM_BUFFER,0,ubo,0,2*sizeof(glm::mat4));

// 方式2：整体绑定整个UBO缓冲区
glBindBufferBase(GL_UNIFORM_BUFFER,0,ubo);
```
## 低版本 OpenGL 绑定方式（4.2 以下）
```c
不支持着色器内 binding 布局，需要代码手动关联块与绑定点：
// 获取Uniform块索引
unsigned int index=glGetUniformBlockIndex(shader.ID,"GlobalMatrices");
// 将该块关联到0号绑定点
glUniformBlockBinding(shader.ID,index,0);
```
需要使用该 Uniform 块的所有着色器，均需执行一次该绑定。
# Uniform 三种内存布局规则
CPU 与 GPU 内存对齐策略不同，必须指定布局规则，才能精准匹配数据偏移。常用三种：**std140、shared、packed**。
## std140
**强制固定对齐规则**，偏移可提前预判计算，适合`UBO`多着色器共享。
**基础对齐规范**
- float / int / bool / uint：基准对齐 4 字节，占用 4 字节
- vec2：基准对齐 8 字节，占用 8 字节
- vec3：基准对齐 16 字节，占用 12 字节
- vec4：基准对齐 16 字节，占用 16 字节
- matN 矩阵：按列拆分为多个 vec4，每列基准对齐 16 字节、占用 16 字节
- 数组：每个元素基准对齐强制 16 字节，元素自身占用按类型计算
- 结构体：整体基准对齐 = 内部最大成员的基准对齐，内部成员按规则排布填充
```glsl
layout (std140) uniform ExampleBlock
{
                     // 基准对齐      // 字节偏移
    float value;     // 4            // 0 
    vec3 vector;     // 16           // 16
    mat4 matrix;     // 16           // 32、48、64、80（四列）
    float values[3]; // 16           // 96、112、128
    bool boolean;    // 4            // 144
    int integer;     // 4            // 148
};
```
整体块占用 **152 字节**，开辟显存时至少分配该大小。
## shared
无强制固定对齐规则，编译器自动优化内存排布，**变量偏移无法预计算**。
使用时需要**运行时查询偏移量**再写入数据：
```c
// 1. 获取块索引
GLuint blockIndex=glGetUniformBlockIndex(shader.ID,"TestBlock");
// 2. 定义成员名数组
const char* names[]={"f","v3","arr[0]"};
GLuint indices[3];
// 3. 获取成员索引
glGetUniformIndices(shader.ID,3,names,indices);
// 4. 查询各成员偏移
GLuint offsets[3];
glGetActiveUniformsiv(shader.ID,3,indices,GL_UNIFORM_OFFSET,offsets);
```
## packed
编译器会**自动优化剔除未使用的 `Uniform` 变量**，内存布局不固定。
**禁止用于 UBO 共享场景**：不同着色器的变量使用情况不同，布局不一致，无法跨程序共享数据。
# UBO 数据填充方式
使用` glBufferSubData `局部更新` UBO` 数据：
```c
glBufferSubData(GL_UNIFORM_BUFFER, 内存偏移, 数据真实大小, 数据指针);
```
参数说明：偏移量为 std140 规则计算出的精准字节偏移，大小为变量真实数据大小，**不包含内存填充空字节**。
# Uniform 块变量访问规则
在着色器代码中，**Uniform 块内部成员变量无需加任何前缀**，可直接访问使用。
# UBO 优势
- **提升渲染效率：**批量合并内存传输，大幅减少 CPU-GPU API 调用次数
- **多着色器共享、易维护：**全局一份统一数据，切换着色器无需重复赋值
- **突破原生 Uniform 数量限制：**原生 Uniform 组件数量上限极低（mat4、vec 数量受限），无法满足骨骼动画等大量矩阵需求；UBO 限制宽松，可承载大批量矩阵数据

# example1: GLSL内建变量
顶点着色器的输出变量`gl_PointSize`。要实现的是离得越远，点越大。那么首先在`main.cpp`我们需要构建一些点，点没有顶点数据，所以无需准备（位置、法线或纹理等顶点属性信息），但是点有位置数据，所以可以定义一个点位置数组（如果要绘制多个点的话）。把这个位置数据直接放入顶点缓冲区，配置顶点指针，然后在渲染循环内使用`glDrawArrays(GL_POINT,0,8)`，第一个参数指明了绘制图元类型为点，第二个参数指明了从顶点缓冲区的第一个顶点开始取数据，第三个参数指明了要取多少个数据（即要画多少个点）。如果需要配置点大小，则需要开启`GL_PROGRAM_POINT_SIZE`，然后在顶点着色器中配置`gl_PointSize`。这里为了实现离得越远，点越大，那么`gl_PointSize=abs(gl_Position.z)`，因为`gl_Position`正是裁剪空间坐标，其`z`坐标的绝对值代表了物体到相机的非线性深度（相机朝`-z`看，如果物体在相机前方，其`z`坐标必定为负数，且离得越远，`z`坐标的绝对值越大）（教程中这里没有加`abs`，但也没有出错，我也不知道为什么，按道理说`gl_Position.z`是负数，赋值给`pointSize`肯定是不合适的。但是我可视化了一下`gl_Position.z`发现它并不是负数，这就更奇怪了）
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
        glEnable(GL_PROGRAM_POINT_SIZE);

        float vertices[] = {
                -0.5f, -0.5f, -0.5f,  0.0f,  0.0f, -1.0f,
                 0.5f, -0.5f, -0.5f,  0.0f,  0.0f, -1.0f,
                 0.5f,  0.5f, -0.5f,  0.0f,  0.0f, -1.0f,
                 0.5f,  0.5f, -0.5f,  0.0f,  0.0f, -1.0f,
                -0.5f,  0.5f, -0.5f,  0.0f,  0.0f, -1.0f,
                -0.5f, -0.5f, -0.5f,  0.0f,  0.0f, -1.0f,

                -0.5f, -0.5f,  0.5f,  0.0f,  0.0f, 1.0f,
                 0.5f, -0.5f,  0.5f,  0.0f,  0.0f, 1.0f,
                 0.5f,  0.5f,  0.5f,  0.0f,  0.0f, 1.0f,
                 0.5f,  0.5f,  0.5f,  0.0f,  0.0f, 1.0f,
                -0.5f,  0.5f,  0.5f,  0.0f,  0.0f, 1.0f,
                -0.5f, -0.5f,  0.5f,  0.0f,  0.0f, 1.0f,

                -0.5f,  0.5f,  0.5f, -1.0f,  0.0f,  0.0f,
                -0.5f,  0.5f, -0.5f, -1.0f,  0.0f,  0.0f,
                -0.5f, -0.5f, -0.5f, -1.0f,  0.0f,  0.0f,
                -0.5f, -0.5f, -0.5f, -1.0f,  0.0f,  0.0f,
                -0.5f, -0.5f,  0.5f, -1.0f,  0.0f,  0.0f,
                -0.5f,  0.5f,  0.5f, -1.0f,  0.0f,  0.0f,

                 0.5f,  0.5f,  0.5f,  1.0f,  0.0f,  0.0f,
                 0.5f,  0.5f, -0.5f,  1.0f,  0.0f,  0.0f,
                 0.5f, -0.5f, -0.5f,  1.0f,  0.0f,  0.0f,
                 0.5f, -0.5f, -0.5f,  1.0f,  0.0f,  0.0f,
                 0.5f, -0.5f,  0.5f,  1.0f,  0.0f,  0.0f,
                 0.5f,  0.5f,  0.5f,  1.0f,  0.0f,  0.0f,

                -0.5f, -0.5f, -0.5f,  0.0f, -1.0f,  0.0f,
                 0.5f, -0.5f, -0.5f,  0.0f, -1.0f,  0.0f,
                 0.5f, -0.5f,  0.5f,  0.0f, -1.0f,  0.0f,
                 0.5f, -0.5f,  0.5f,  0.0f, -1.0f,  0.0f,
                -0.5f, -0.5f,  0.5f,  0.0f, -1.0f,  0.0f,
                -0.5f, -0.5f, -0.5f,  0.0f, -1.0f,  0.0f,

                -0.5f,  0.5f, -0.5f,  0.0f,  1.0f,  0.0f,
                 0.5f,  0.5f, -0.5f,  0.0f,  1.0f,  0.0f,
                 0.5f,  0.5f,  0.5f,  0.0f,  1.0f,  0.0f,
                 0.5f,  0.5f,  0.5f,  0.0f,  1.0f,  0.0f,
                -0.5f,  0.5f,  0.5f,  0.0f,  1.0f,  0.0f,
                -0.5f,  0.5f, -0.5f,  0.0f,  1.0f,  0.0f
        };

        float pointPositions[] = {
                0.0f, 0.0f, 0.0f,

                1.0f, 0.0f, 0.0f,

                -1.0f,0.0f,0.0f,

                0.0f, 1.0f, 0.0f,

                0.0f,-1.0f,0.0f,

                0.0f, 0.0f, 1.0f,

                0.0f, 0.0f,-1.0f,

                2.0f, 0.0f, 0.0f
        };

        unsigned int pointVAO, pointVBO;
        glGenVertexArrays(1, &pointVAO);
        glGenBuffers(1, & pointVBO);
        glBindVertexArray(pointVAO);
        glBindBuffer(GL_ARRAY_BUFFER, pointVBO);
        glBufferData(GL_ARRAY_BUFFER, sizeof(pointPositions), pointPositions, GL_STATIC_DRAW);
        glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 3 * sizeof(float), (void*)0);
        glEnableVertexAttribArray(0);

        glBindVertexArray(0);

        Shader shader("src/Shader/vertexShader.txt", "src/Shader/fragmentShader.txt");

        while (!glfwWindowShouldClose(window)) {
                float currentFrame = (float)glfwGetTime();
                deltaTime = currentFrame - lastFrame;
                lastFrame = currentFrame;

                processInput(window);

                glClearColor(0.1, 0.1, 0.1, 1.0);
                glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

                shader.use();
                glm::mat4 view = camera.GetCameraView();
                glm::mat4 project = glm::perspective(glm::radians(camera.Zoom),(float)SCR_WIDTH / SCR_HEIGHT, 0.1f, 100.0f);
                glm::mat4 model = glm::mat4(1.0f);
                shader.setMatrix("model", model);
                shader.setMatrix("view", view);
                shader.setMatrix("project", project);

                glBindVertexArray(pointVAO);
                glDrawArrays(GL_POINTS, 0, 8);
                glBindVertexArray(0);

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
layout (location = 0) in vec3 aPos;

uniform mat4 model;
uniform mat4 view;
uniform mat4 project;

void main(){
        gl_Position=project*view*model*vec4(aPos,1.0);
        gl_PointSize=gl_Position.z;
}
```
```glsl
//fragmentShader
#version 330 core

out vec4 FragColor;

void main(){
        FragColor=vec4(vec3(0.5),1.0);
}
```
![BQACAgUAAyEGAASHRsPbAAEWLONqP4IAARW5_f3btZQv__VDgav7e0AAAmkmAAJNOQFW9DMzFkcyPxM8BA.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWLONqP4IAARW5_f3btZQv__VDgav7e0AAAmkmAAJNOQFW9DMzFkcyPxM8BA.png)
顶点着色器的输入变量`gl_VertexID`。表示当前正在处理的顶点在本次绘制调用中的索引。从`0`开始递增，每处理一个顶点，值`+1`.对使用`glDrawArrays`绘制而言，`gl_VertexID`是顶点的全局序号，从`start`开始，每画一个顶点，`gl_VertexID+1`。对使用`glDrawELements`绘制而言，`gl_VertexID`是绘制顶点本身的索引。它的用途可以是：不需要在C++里准备完整顶点数据，靠`gl_VertexID`在着色器中区分顶点，减少CPU-GPU的数据传输。
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
        glEnable(GL_PROGRAM_POINT_SIZE);

        float vertices[] = {
                -0.5f, -0.5f, -0.5f,  0.0f,  0.0f, -1.0f,
                 0.5f, -0.5f, -0.5f,  0.0f,  0.0f, -1.0f,
                 0.5f,  0.5f, -0.5f,  0.0f,  0.0f, -1.0f,
                 0.5f,  0.5f, -0.5f,  0.0f,  0.0f, -1.0f,
                -0.5f,  0.5f, -0.5f,  0.0f,  0.0f, -1.0f,
                -0.5f, -0.5f, -0.5f,  0.0f,  0.0f, -1.0f,

                -0.5f, -0.5f,  0.5f,  0.0f,  0.0f, 1.0f,
                 0.5f, -0.5f,  0.5f,  0.0f,  0.0f, 1.0f,
                 0.5f,  0.5f,  0.5f,  0.0f,  0.0f, 1.0f,
                 0.5f,  0.5f,  0.5f,  0.0f,  0.0f, 1.0f,
                -0.5f,  0.5f,  0.5f,  0.0f,  0.0f, 1.0f,
                -0.5f, -0.5f,  0.5f,  0.0f,  0.0f, 1.0f,

                -0.5f,  0.5f,  0.5f, -1.0f,  0.0f,  0.0f,
                -0.5f,  0.5f, -0.5f, -1.0f,  0.0f,  0.0f,
                -0.5f, -0.5f, -0.5f, -1.0f,  0.0f,  0.0f,
                -0.5f, -0.5f, -0.5f, -1.0f,  0.0f,  0.0f,
                -0.5f, -0.5f,  0.5f, -1.0f,  0.0f,  0.0f,
                -0.5f,  0.5f,  0.5f, -1.0f,  0.0f,  0.0f,

                 0.5f,  0.5f,  0.5f,  1.0f,  0.0f,  0.0f,
                 0.5f,  0.5f, -0.5f,  1.0f,  0.0f,  0.0f,
                 0.5f, -0.5f, -0.5f,  1.0f,  0.0f,  0.0f,
                 0.5f, -0.5f, -0.5f,  1.0f,  0.0f,  0.0f,
                 0.5f, -0.5f,  0.5f,  1.0f,  0.0f,  0.0f,
                 0.5f,  0.5f,  0.5f,  1.0f,  0.0f,  0.0f,

                -0.5f, -0.5f, -0.5f,  0.0f, -1.0f,  0.0f,
                 0.5f, -0.5f, -0.5f,  0.0f, -1.0f,  0.0f,
                 0.5f, -0.5f,  0.5f,  0.0f, -1.0f,  0.0f,
                 0.5f, -0.5f,  0.5f,  0.0f, -1.0f,  0.0f,
                -0.5f, -0.5f,  0.5f,  0.0f, -1.0f,  0.0f,
                -0.5f, -0.5f, -0.5f,  0.0f, -1.0f,  0.0f,

                -0.5f,  0.5f, -0.5f,  0.0f,  1.0f,  0.0f,
                 0.5f,  0.5f, -0.5f,  0.0f,  1.0f,  0.0f,
                 0.5f,  0.5f,  0.5f,  0.0f,  1.0f,  0.0f,
                 0.5f,  0.5f,  0.5f,  0.0f,  1.0f,  0.0f,
                -0.5f,  0.5f,  0.5f,  0.0f,  1.0f,  0.0f,
                -0.5f,  0.5f, -0.5f,  0.0f,  1.0f,  0.0f
        };
        
        //只存了一个顶点的数据
        float pointPositions[] = {
                0.0f, 0.0f, 0.0f
        };

        unsigned int pointVAO, pointVBO;
        glGenVertexArrays(1, &pointVAO);
        glGenBuffers(1, & pointVBO);
        glBindVertexArray(pointVAO);
        glBindBuffer(GL_ARRAY_BUFFER, pointVBO);
        glBufferData(GL_ARRAY_BUFFER, sizeof(pointPositions), pointPositions, GL_STATIC_DRAW);
        glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 3 * sizeof(float), (void*)0);
        glEnableVertexAttribArray(0);

        glBindVertexArray(0);

        Shader shader("src/Shader/vertexShader.txt", "src/Shader/fragmentShader.txt");

        while (!glfwWindowShouldClose(window)) {
                float currentFrame = (float)glfwGetTime();
                deltaTime = currentFrame - lastFrame;
                lastFrame = currentFrame;

                processInput(window);

                glClearColor(0.1, 0.1, 0.1, 1.0);
                glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

                shader.use();
                glm::mat4 view = camera.GetCameraView();
                glm::mat4 project = glm::perspective(glm::radians(camera.Zoom),(float)SCR_WIDTH / SCR_HEIGHT, 0.1f, 100.0f);
                glm::mat4 model = glm::mat4(1.0f);
                shader.setMatrix("model", model);
                shader.setMatrix("view", view);
                shader.setMatrix("project", project);

                glBindVertexArray(pointVAO);
                glDrawArrays(GL_POINTS, 0, 15);//要求GPU连续处理15个顶点，而缓冲区只有1组数据，那么就循环复用缓冲区里的顶点数据
                glBindVertexArray(0);

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
layout (location = 0) in vec3 aPos;

uniform mat4 model;
uniform mat4 view;
uniform mat4 project;

out vec3 ourColor;

void main(){
        //根据变化的gl_VertexID计算顶点的差异化位置、大小、颜色
        float offsetX=gl_VertexID*0.6;
        vec3 newPos=aPos+vec3(offsetX,0.0,0.0);
        gl_Position=project*view*model*vec4(newPos,1.0);
        gl_PointSize=8.0+gl_VertexID*1.2;
        ourColor=vec3(gl_VertexID/15.0,0.3,0.8);
}
```
```glsl
//fragmentShader
#version 330 core
in vec3 ourColor;
out vec4 FragColor;

void main(){
        FragColor=vec4(ourColor,1.0);
}
```
![BQACAgUAAyEGAASHRsPbAAEWLPNqP4JvYkC4FbxZIrEJyfvIOmDxBAACfyYAAk05AVZcWWFl6jlLpDwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWLPNqP4JvYkC4FbxZIrEJyfvIOmDxBAACfyYAAk05AVZcWWFl6jlLpDwE.png)
还可以是**构建程序化网格**：根据`gl_VertexID`计算点的行数和列数，分别赋予不同的颜色
```glsl
//vertexShader
#version 330 core
layout (location = 0) in vec3 aPos;

uniform mat4 model;
uniform mat4 view;
uniform mat4 project;

out vec3 ourColor;

void main(){
        //根据变化的gl_VertexID计算顶点的差异化位置、颜色
        float row=floor(gl_VertexID/10.0);
        float col=mod(gl_VertexID,10.0);
        vec3 gridPos=vec3(col*0.6,row*0.6,0.0);
        gl_Position=project*view*model*vec4(gridPos,1.0);
        gl_PointSize=8.0;
        ourColor=vec3(gl_VertexID/20.0,0.3,0.8);
}
```
![BQACAgUAAyEGAASHRsPbAAEWLPtqP4Kt8U-UStmLds75fqYGbSQf2AACjSYAAk05AVa-y-wdEBHsrDwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWLPtqP4Kt8U-UStmLds75fqYGbSQf2AACjSYAAk05AVa-y-wdEBHsrDwE.png)
还可以是CPU传入顶点颜色/纹理数组，然后使用`gl_VertexID`作为下标取值。
片元着色器的输入`gl_FragCoord`。是屏幕空间的坐标，其`x`和`y`分量分别的范围是`[0,screen_width]`和`[0,screenHeight]`，其`z`分量是片元的真实非线性深度值，范围是`[0,1]`，可用于深度测试。此外，`gl_FragCoord`还可以用于技术演示，划分屏幕范围，特定的区域显示特定的颜色。如下例中屏幕左半部分显示红色，右半部分显示绿色。
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
        glEnable(GL_PROGRAM_POINT_SIZE);

        float vertices[] = {
                -0.5f, -0.5f, -0.5f,  0.0f,  0.0f, -1.0f,
                 0.5f, -0.5f, -0.5f,  0.0f,  0.0f, -1.0f,
                 0.5f,  0.5f, -0.5f,  0.0f,  0.0f, -1.0f,
                 0.5f,  0.5f, -0.5f,  0.0f,  0.0f, -1.0f,
                -0.5f,  0.5f, -0.5f,  0.0f,  0.0f, -1.0f,
                -0.5f, -0.5f, -0.5f,  0.0f,  0.0f, -1.0f,

                -0.5f, -0.5f,  0.5f,  0.0f,  0.0f, 1.0f,
                 0.5f, -0.5f,  0.5f,  0.0f,  0.0f, 1.0f,
                 0.5f,  0.5f,  0.5f,  0.0f,  0.0f, 1.0f,
                 0.5f,  0.5f,  0.5f,  0.0f,  0.0f, 1.0f,
                -0.5f,  0.5f,  0.5f,  0.0f,  0.0f, 1.0f,
                -0.5f, -0.5f,  0.5f,  0.0f,  0.0f, 1.0f,

                -0.5f,  0.5f,  0.5f, -1.0f,  0.0f,  0.0f,
                -0.5f,  0.5f, -0.5f, -1.0f,  0.0f,  0.0f,
                -0.5f, -0.5f, -0.5f, -1.0f,  0.0f,  0.0f,
                -0.5f, -0.5f, -0.5f, -1.0f,  0.0f,  0.0f,
                -0.5f, -0.5f,  0.5f, -1.0f,  0.0f,  0.0f,
                -0.5f,  0.5f,  0.5f, -1.0f,  0.0f,  0.0f,

                 0.5f,  0.5f,  0.5f,  1.0f,  0.0f,  0.0f,
                 0.5f,  0.5f, -0.5f,  1.0f,  0.0f,  0.0f,
                 0.5f, -0.5f, -0.5f,  1.0f,  0.0f,  0.0f,
                 0.5f, -0.5f, -0.5f,  1.0f,  0.0f,  0.0f,
                 0.5f, -0.5f,  0.5f,  1.0f,  0.0f,  0.0f,
                 0.5f,  0.5f,  0.5f,  1.0f,  0.0f,  0.0f,

                -0.5f, -0.5f, -0.5f,  0.0f, -1.0f,  0.0f,
                 0.5f, -0.5f, -0.5f,  0.0f, -1.0f,  0.0f,
                 0.5f, -0.5f,  0.5f,  0.0f, -1.0f,  0.0f,
                 0.5f, -0.5f,  0.5f,  0.0f, -1.0f,  0.0f,
                -0.5f, -0.5f,  0.5f,  0.0f, -1.0f,  0.0f,
                -0.5f, -0.5f, -0.5f,  0.0f, -1.0f,  0.0f,

                -0.5f,  0.5f, -0.5f,  0.0f,  1.0f,  0.0f,
                 0.5f,  0.5f, -0.5f,  0.0f,  1.0f,  0.0f,
                 0.5f,  0.5f,  0.5f,  0.0f,  1.0f,  0.0f,
                 0.5f,  0.5f,  0.5f,  0.0f,  1.0f,  0.0f,
                -0.5f,  0.5f,  0.5f,  0.0f,  1.0f,  0.0f,
                -0.5f,  0.5f, -0.5f,  0.0f,  1.0f,  0.0f
        };
        

        unsigned int cubeVAO, cubeVBO;
        glGenVertexArrays(1, &cubeVAO);
        glGenBuffers(1, &cubeVBO);

        glBindVertexArray(cubeVAO);
        glBindBuffer(GL_ARRAY_BUFFER, cubeVBO);
        glBufferData(GL_ARRAY_BUFFER, sizeof(vertices), vertices, GL_STATIC_DRAW);
        glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 6 * sizeof(float), (void*)0);
        glEnableVertexAttribArray(0);
        glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, 6 * sizeof(float), (void*)(3 * sizeof(float)));
        glEnableVertexAttribArray(1);

        Shader shader("src/Shader/vertexShader.txt", "src/Shader/fragmentShader.txt");

        while (!glfwWindowShouldClose(window)) {
                float currentFrame = (float)glfwGetTime();
                deltaTime = currentFrame - lastFrame;
                lastFrame = currentFrame;

                processInput(window);

                glClearColor(0.1, 0.1, 0.1, 1.0);
                glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

                shader.use();
                glm::mat4 view = camera.GetCameraView();
                glm::mat4 project = glm::perspective(glm::radians(camera.Zoom),(float)SCR_WIDTH / SCR_HEIGHT, 0.1f, 100.0f);
                glm::mat4 model = glm::mat4(1.0f);
                shader.setMatrix("model", model);
                shader.setMatrix("view", view);
                shader.setMatrix("project", project);

                glBindVertexArray(cubeVAO);
                glDrawArrays(GL_TRIANGLES, 0, 36);
                glBindVertexArray(0);

                glfwSwapBuffers(window);
                glfwPollEvents();
        }
        glDeleteVertexArrays(1, &cubeVAO);
        glDeleteBuffers(1, &cubeVBO);

        glfwTerminate();
        return 0;
}
```
```glsl
//vertexShader
#version 330 core
layout (location = 0) in vec3 aPos;
layout (location = 1) in vec3 aNormal;

uniform mat4 model;
uniform mat4 view;
uniform mat4 project;

void main(){
        gl_Position=project*view*model*vec4(aPos,1.0);
}
```
```glsl
//fragmentShader
#version 330 core
out vec4 FragColor;

void main(){
        if(gl_FragCoord.x<400){
                FragColor=vec4(1.0,0.0,0.0,1.0);
        }else{
                FragColor=vec4(0.0,1.0,0.0,1.0);
        }
}
```
![BQACAgUAAyEGAASHRsPbAAEWLQtqP4Mw5v3gD5CELTQjiDYifmXBuAACnSYAAk05AVbfrSuC5hL1yzwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWLQtqP4Mw5v3gD5CELTQjiDYifmXBuAACnSYAAk05AVbfrSuC5hL1yzwE.png)
![BQACAgUAAyEGAASHRsPbAAEWLQxqP4NDai-DTuzSnq4pxvMHw3FvlAACoCYAAk05AVY3teIbRqO_DTwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWLQxqP4NDai-DTuzSnq4pxvMHw3FvlAACoCYAAk05AVY3teIbRqO_DTwE.png)
![BQACAgUAAyEGAASHRsPbAAEWLQ5qP4NS-yJ442_q1rSABODaO1DsLAACoyYAAk05AVaB3CvzNBywijwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWLQ5qP4NS-yJ442_q1rSABODaO1DsLAACoyYAAk05AVaB3CvzNBywijwE.png)
还可以用于测试不同的光照模型：下例中左半部分采用**phong光照模型**（反射向量和视角方向接近度），右半部分采用**blinn-phong光照模型**（半角向量和法向量接近度），观察高光部分的不同。可以看到**blinn-phong光照模型**下高光形状更自然。
```glsl
//fragmentShader
#version 330 core
in vec3 FragPos;
in vec3 Normal;

out vec4 FragColor;

uniform vec3 lightPos;
uniform vec3 viewPos;
void main(){
        vec2 uv=gl_FragCoord.xy/vec2(800,400);
        vec3 worldNormal=normalize(Normal);
        vec3 worldLightDir=normalize(lightPos-FragPos);
        vec3 worldViewDir=normalize(viewPos-FragPos);

        float diff=max(dot(worldNormal,worldLightDir),0.0);
        vec3 lightDiffuse=vec3(0.8f);
        vec3 diffuseColor=vec3(0.1,0.6,0.2);
        vec3 diffuse=lightDiffuse*diff*diffuseColor;

        vec3 lightAmbient=vec3(0.1f);
        vec3 ambient=lightAmbient*diffuseColor;

        float spec=0.0f;
        if(gl_FragCoord.x<400){
                vec3 reflectDir=reflect(-worldLightDir,worldNormal);
                spec=pow(max(dot(worldViewDir,reflectDir),0.0f),32.0f);
        }else{
                vec3 halfDir=normalize(worldLightDir+worldViewDir);
                spec=pow(max(dot(worldNormal,halfDir),0.0f),32.0f);
        }
        vec3 lightSpecular=vec3(1.0f);
        vec3 specular=lightSpecular*spec*vec3(1.0f);

        FragColor=vec4(ambient+diffuse+specular,1.0);
}
```
![BQACAgUAAyEGAASHRsPbAAEWLRFqP4OaW9fJ7As-HAME8N-HqyO1twACqiYAAk05AVZ4Bd1YiQYMxTwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWLRFqP4OaW9fJ7As-HAME8N-HqyO1twACqiYAAk05AVZ4Bd1YiQYMxTwE.png)
![BQACAgUAAyEGAASHRsPbAAEWLRNqP4OxG_GZ2ZLay9z6hIq4PLYclgACrSYAAk05AVaAduZzCa5oJTwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWLRNqP4OxG_GZ2ZLay9z6hIq4PLYclgACrSYAAk05AVaAduZzCa5oJTwE.png)
片元着色器的输入变量`gl_FrontFacing`，返回一个`bool`类型的值，反应当前片元是正面面的一部分，还是背面面的一部分。仅在不开启面剔除时使用，因为开启面剔除之后，有一类面（正向面/背向面）总是会被剔除，那么`gl_FrontFacing`总是返回`true/false`，没有使用的意义了。下例中为模型的正向面和背向面分别赋予不同的纹理。编写代码时一定要注意关闭面剔除，以及顶点的定义需要遵循背向面顺时针，正向面逆时针（或者反过来，关键是要全部背面统一，全部正面统一）
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

        stbi_set_flip_vertically_on_load(true);

        glEnable(GL_DEPTH_TEST);
        glDisable(GL_CULL_FACE);

        float vertices[] = {
                // Back face
                -0.5f, -0.5f, -0.5f,  0.0f, 0.0f, // Bottom-left
                 0.5f,  0.5f, -0.5f,  1.0f, 1.0f, // top-right
                 0.5f, -0.5f, -0.5f,  1.0f, 0.0f, // bottom-right         
                 0.5f,  0.5f, -0.5f,  1.0f, 1.0f, // top-right
                -0.5f, -0.5f, -0.5f,  0.0f, 0.0f, // bottom-left
                -0.5f,  0.5f, -0.5f,  0.0f, 1.0f, // top-left
                // Front face
                -0.5f, -0.5f,  0.5f,  0.0f, 0.0f, // bottom-left
                 0.5f, -0.5f,  0.5f,  1.0f, 0.0f, // bottom-right
                 0.5f,  0.5f,  0.5f,  1.0f, 1.0f, // top-right
                 0.5f,  0.5f,  0.5f,  1.0f, 1.0f, // top-right
                -0.5f,  0.5f,  0.5f,  0.0f, 1.0f, // top-left
                -0.5f, -0.5f,  0.5f,  0.0f, 0.0f, // bottom-left
                // Left face
                -0.5f,  0.5f,  0.5f,  1.0f, 0.0f, // top-right
                -0.5f,  0.5f, -0.5f,  1.0f, 1.0f, // top-left
                -0.5f, -0.5f, -0.5f,  0.0f, 1.0f, // bottom-left
                -0.5f, -0.5f, -0.5f,  0.0f, 1.0f, // bottom-left
                -0.5f, -0.5f,  0.5f,  0.0f, 0.0f, // bottom-right
                -0.5f,  0.5f,  0.5f,  1.0f, 0.0f, // top-right
                // Right face
                 0.5f,  0.5f,  0.5f,  1.0f, 0.0f, // top-left
                 0.5f, -0.5f, -0.5f,  0.0f, 1.0f, // bottom-right
                 0.5f,  0.5f, -0.5f,  1.0f, 1.0f, // top-right         
                 0.5f, -0.5f, -0.5f,  0.0f, 1.0f, // bottom-right
                 0.5f,  0.5f,  0.5f,  1.0f, 0.0f, // top-left
                 0.5f, -0.5f,  0.5f,  0.0f, 0.0f, // bottom-left     
                 // Bottom face
                 -0.5f, -0.5f, -0.5f,  0.0f, 1.0f, // top-right
                  0.5f, -0.5f, -0.5f,  1.0f, 1.0f, // top-left
                  0.5f, -0.5f,  0.5f,  1.0f, 0.0f, // bottom-left
                  0.5f, -0.5f,  0.5f,  1.0f, 0.0f, // bottom-left
                 -0.5f, -0.5f,  0.5f,  0.0f, 0.0f, // bottom-right
                 -0.5f, -0.5f, -0.5f,  0.0f, 1.0f, // top-right
                 // Top face
                 -0.5f,  0.5f, -0.5f,  0.0f, 1.0f, // top-left
                  0.5f,  0.5f,  0.5f,  1.0f, 0.0f, // bottom-right
                  0.5f,  0.5f, -0.5f,  1.0f, 1.0f, // top-right     
                  0.5f,  0.5f,  0.5f,  1.0f, 0.0f, // bottom-right
                 -0.5f,  0.5f, -0.5f,  0.0f, 1.0f, // top-left
                 -0.5f,  0.5f,  0.5f,  0.0f, 0.0f  // bottom-left        
        };
        
        unsigned int cubeVAO, cubeVBO;
        glGenVertexArrays(1, &cubeVAO);
        glGenBuffers(1, &cubeVBO);

        glBindVertexArray(cubeVAO);
        glBindBuffer(GL_ARRAY_BUFFER, cubeVBO);
        glBufferData(GL_ARRAY_BUFFER, sizeof(vertices), vertices, GL_STATIC_DRAW);
        glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 5 * sizeof(float), (void*)0);
        glEnableVertexAttribArray(0);
        glVertexAttribPointer(1, 2, GL_FLOAT, GL_FALSE, 5 * sizeof(float), (void*)(3 * sizeof(float)));
        glEnableVertexAttribArray(1);

        Shader shader("src/Shader/vertexShader.txt", "src/Shader/fragmentShader.txt");

        unsigned int frontTexture = loadTexture("resources/textures/container.jpg");
        unsigned int backTexture = loadTexture("resources/textures/marble.jpg");

        shader.use();
        shader.setInt("frontTexture", 0);
        shader.setInt("backTexture", 1);

        while (!glfwWindowShouldClose(window)) {
                float currentFrame = (float)glfwGetTime();
                deltaTime = currentFrame - lastFrame;
                lastFrame = currentFrame;

                processInput(window);

                glClearColor(0.1, 0.1, 0.1, 1.0);
                glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

                shader.use();
                glm::mat4 view = camera.GetCameraView();
                glm::mat4 project = glm::perspective(glm::radians(camera.Zoom),(float)SCR_WIDTH / SCR_HEIGHT, 0.1f, 100.0f);
                glm::mat4 model = glm::mat4(1.0f);
                shader.setMatrix("model", model);
                shader.setMatrix("view", view);
                shader.setMatrix("project", project);

                glActiveTexture(GL_TEXTURE0);
                glBindTexture(GL_TEXTURE_2D, frontTexture);
                glActiveTexture(GL_TEXTURE1);
                glBindTexture(GL_TEXTURE_2D, backTexture);

                glBindVertexArray(cubeVAO);
                glDrawArrays(GL_TRIANGLES, 0, 36);
                glBindVertexArray(0);

                glfwSwapBuffers(window);
                glfwPollEvents();
        }
        glDeleteVertexArrays(1, &cubeVAO);
        glDeleteBuffers(1, &cubeVBO);

        glfwTerminate();
        return 0;
}
```
```glsl
//vertexShader
#version 330 core
layout (location = 0) in vec3 aPos;
layout (location = 1) in vec2 aTexCoords;

out vec2 TexCoords;

uniform mat4 model;
uniform mat4 view;
uniform mat4 project;

void main(){
        gl_Position=project*view*model*vec4(aPos,1.0);
        TexCoords=aTexCoords;
}
```
```glsl
//fragmentShader
#version 330 core

in vec2 TexCoords;
out vec4 FragColor;

uniform sampler2D frontTexture;
uniform sampler2D backTexture;

void main(){
        if(gl_FrontFacing){
                FragColor=texture(frontTexture,TexCoords);
        }else{
                FragColor=texture(backTexture,TexCoords);
        }
}
```
![BQACAgUAAyEGAASHRsPbAAEWLR5qP4QDBjPo2okk5LolD1_O5-H5IgACuSYAAk05AVb5jbNk-OmTHzwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWLR5qP4QDBjPo2okk5LolD1_O5-H5IgACuSYAAk05AVb5jbNk-OmTHzwE.png)
`gl_FragCoord`还可以用于实现双面材质的物体、双面光照，以及描边轮廓（检测到背面，输出纯色描边）。此外，默认是剔除背面，也可以通过`glCullFace`设置要剔除的面。
片元着色器的输出变量`gl_FragDepth`，默认值等于`gl_FragCoord.z`，但是`gl_FragCoord`作为一个输入变量，它是只读的，所以如果我们要修改片元深度，就只能使用`gl_FragDepth`。但之前说过，如果要在片元着色器修改深度，那么`early-z`就禁用了，因为`early-z`时并不知道当前片元是否会被剔除，无法预知修改后的片元深度。但是**opengl4.2版本以上**给我们提供了有条件的修改。
```glsl
//fragmentShader
//片元着色器中修改后的深度只能比原始深度（即gl_FragCoord.z大）
//这种情况下，如果原始深度>缓冲深度，那么修改后的深度必定也>缓冲深度，一定可以被early-z剔除
layout (depth_greater) out float gl_FragDepth;
//片元着色器中修改后的深度只能比原始深度小
//这种情况下，如果原始深度<缓冲深度，那么修改后的深度必定也<缓冲深度，一定可以被early-z保留
layout (depth_less) out float gl_FragDepth;
//片元着色器中修改后的深度和原始深度关系未知，可大可小
layout (depth_any) out float gl_FragDepth;
//片元着色器中未对深度进行修改
layout (depth_unchanged) out float gl_FragDepth;
```

# example2: 接口块
**使用接口块的原因：使代码模块化，**当传递的变量很少时，零散`in/out`无所谓，但当渲染管线复杂时，可能有十几二十个变量，接口块可以把所有传递数据收拢到一个结构体，语义清晰。
```glsl
//vertexShader
#version 330 core
layout (location = 0) in vec3 aPos;
layout (location = 1) in vec2 aTexCoords;

out VS_OUT{
        vec2 TexCoords;
}vs_out;

uniform mat4 model;
uniform mat4 view;
uniform mat4 project;

void main(){
        gl_Position=project*view*model*vec4(aPos,1.0);
        vs_out.TexCoords=aTexCoords;
}
```
```glsl
//fragmentShader
#version 330 core

in VS_OUT{
        vec2 TexCoords;
}fs_in;
out vec4 FragColor;

uniform sampler2D frontTexture;
uniform sampler2D backTexture;

void main(){
        if(gl_FrontFacing){
                FragColor=texture(frontTexture,fs_in.TexCoords);
        }else{
                FragColor=texture(backTexture,fs_in.TexCoords);
        }
}
```

# example3: uniform缓冲
使用多个着色器绘制不同的模型，但所有着色器共享一套`matrices uniform`结构块，对其中的变量`view`和`project`矩阵只需赋值一次，体现`UBO`跨着色器共享`uniform`的价值。
**首先是创建`UBO`缓冲，**与创建`VBO`的步骤类似。在使用`glBufferData`开辟缓冲占据内存时，开辟的大小由缓冲内所有`uniform`块的内存决定，而`uniform`块的内存由它要存储的变量决定，本例中只有一个`uniform`块，且`uniform`块内只是两个`mat`矩阵。
**然后是将创建的`UBO`缓冲绑定到绑定点。**
**然后使用`glBufferSubData`写入数据**，需要知道数据的起始偏移位置和数据的大小。
**然后创建若干个着色器程序**，分别将其中的`uniform`块绑定到与`UBO`一样的绑定点。
最后在渲染循环中分别激活这些着色器程序，设置变化的变量或私有的变量，绘制。
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

        float vertices[] = {
                // positions         
                -0.5f, -0.5f, -0.5f,
                 0.5f, -0.5f, -0.5f,
                 0.5f,  0.5f, -0.5f,
                 0.5f,  0.5f, -0.5f,
                -0.5f,  0.5f, -0.5f,
                -0.5f, -0.5f, -0.5f,

                -0.5f, -0.5f,  0.5f,
                 0.5f, -0.5f,  0.5f,
                 0.5f,  0.5f,  0.5f,
                 0.5f,  0.5f,  0.5f,
                -0.5f,  0.5f,  0.5f,
                -0.5f, -0.5f,  0.5f,

                -0.5f,  0.5f,  0.5f,
                -0.5f,  0.5f, -0.5f,
                -0.5f, -0.5f, -0.5f,
                -0.5f, -0.5f, -0.5f,
                -0.5f, -0.5f,  0.5f,
                -0.5f,  0.5f,  0.5f,

                 0.5f,  0.5f,  0.5f,
                 0.5f,  0.5f, -0.5f,
                 0.5f, -0.5f, -0.5f,
                 0.5f, -0.5f, -0.5f,
                 0.5f, -0.5f,  0.5f,
                 0.5f,  0.5f,  0.5f,

                -0.5f, -0.5f, -0.5f,
                 0.5f, -0.5f, -0.5f,
                 0.5f, -0.5f,  0.5f,
                 0.5f, -0.5f,  0.5f,
                -0.5f, -0.5f,  0.5f,
                -0.5f, -0.5f, -0.5f,

                -0.5f,  0.5f, -0.5f,
                 0.5f,  0.5f, -0.5f,
                 0.5f,  0.5f,  0.5f,
                 0.5f,  0.5f,  0.5f,
                -0.5f,  0.5f,  0.5f,
                -0.5f,  0.5f, -0.5f,
        };
        
        unsigned int cubeVAO, cubeVBO;
        glGenVertexArrays(1, &cubeVAO);
        glGenBuffers(1, &cubeVBO);

        glBindVertexArray(cubeVAO);
        glBindBuffer(GL_ARRAY_BUFFER, cubeVBO);
        glBufferData(GL_ARRAY_BUFFER, sizeof(vertices), vertices, GL_STATIC_DRAW);
        glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 3 * sizeof(float), (void*)0);
        glEnableVertexAttribArray(0);
        glBindVertexArray(0);
        glBindBuffer(GL_ARRAY_BUFFER, 0);

        //创建uniform缓冲对象
        unsigned int uboMatrices;
        glGenBuffers(1, &uboMatrices);
        glBindBuffer(GL_UNIFORM_BUFFER, uboMatrices);
        glBufferData(GL_UNIFORM_BUFFER, 2 * sizeof(glm::mat4), NULL, GL_STATIC_DRAW);
        glBindBuffer(GL_UNIFORM_BUFFER, 0);

        //关联缓冲对象到绑定点
        glBindBufferRange(GL_UNIFORM_BUFFER, 0, uboMatrices, 0, 2 * sizeof(glm::mat4));

        //填充缓冲对象
        //先填充渲染过程中不会变的成员变量
        glm::mat4 project = glm::perspective(glm::radians(45.0f), (float)SCR_WIDTH / (float)SCR_HEIGHT, 0.1f, 100.0f);//相机没有缩放了，固定fov为45度
        glBindBuffer(GL_UNIFORM_BUFFER, uboMatrices);
        glBufferSubData(GL_UNIFORM_BUFFER, 0, sizeof(glm::mat4), glm::value_ptr(project));//为什么需要value_ptr？glm::mat4是C++类/结构体，而glBufferSubData等OpenGL API只接收原生指针，value_ptr会返回矩阵内部底层float数组首地址
        glBindBuffer(GL_UNIFORM_BUFFER, 0);

        Shader shader1("src/Shader/vertexShader.txt", "src/Shader/fragmentShader.txt");
        Shader shader2("src/Shader/vertexShader.txt", "src/Shader/fragmentShader2.txt");
        Shader shader3("src/Shader/vertexShader.txt", "src/Shader/fragmentShader3.txt");
        Shader shader4("src/Shader/vertexShader.txt", "src/Shader/fragmentShader4.txt");

        //为顶点着色器中的uniform块关联绑定点
        //获得uniform块的位置值
        unsigned int uniformBlockIndexRed = glGetUniformBlockIndex(shader1.ID, "Matrices");
        unsigned int uniformBlockIndexGreen = glGetUniformBlockIndex(shader2.ID, "Matrices");
        unsigned int uniformBlockIndexBlue = glGetUniformBlockIndex(shader3.ID, "Matrices");
        unsigned int uniformBlockIndexYellow = glGetUniformBlockIndex(shader4.ID, "Matrices");
        //关联绑定点
        glUniformBlockBinding(shader1.ID, uniformBlockIndexRed, 0);
        glUniformBlockBinding(shader2.ID, uniformBlockIndexGreen, 0);
        glUniformBlockBinding(shader3.ID, uniformBlockIndexBlue, 0);
        glUniformBlockBinding(shader4.ID, uniformBlockIndexYellow, 0);

        while (!glfwWindowShouldClose(window)) {
                float currentFrame = (float)glfwGetTime();
                deltaTime = currentFrame - lastFrame;
                lastFrame = currentFrame;

                processInput(window);

                glClearColor(0.1, 0.1, 0.1, 1.0);
                glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

                glm::mat4 view = camera.GetCameraView();
                glBindBuffer(GL_UNIFORM_BUFFER, uboMatrices);
                glBufferSubData(GL_UNIFORM_BUFFER, sizeof(glm::mat4), sizeof(glm::mat4), glm::value_ptr(view));
                glBindBuffer(GL_UNIFORM_BUFFER, 0);

                glBindVertexArray(cubeVAO);
                shader1.use();
                glm::mat4 model;
                model = glm::translate(model, glm::vec3(-0.75f, 0.75f, 0.0f));
                shader1.setMatrix("model", model);
                glDrawArrays(GL_TRIANGLES, 0, 36);

                shader2.use();
                model = glm::mat4(1.0f);
                model = glm::translate(model, glm::vec3(0.75f, 0.75f, 0.0f));
                shader2.setMatrix("model", model);
                glDrawArrays(GL_TRIANGLES, 0, 36);

                shader3.use();
                model = glm::mat4(1.0f);
                model = glm::translate(model, glm::vec3(-0.75f, -0.75f, 0.0f));
                shader3.setMatrix("model", model);
                glDrawArrays(GL_TRIANGLES, 0, 36);

                shader4.use();
                model = glm::mat4(1.0f);
                model = glm::translate(model, glm::vec3(0.75f, -0.75f, 0.0f));
                shader4.setMatrix("model", model);
                glDrawArrays(GL_TRIANGLES, 0, 36);

                glBindVertexArray(0);

                glfwSwapBuffers(window);
                glfwPollEvents();
        }
        glDeleteVertexArrays(1, &cubeVAO);
        glDeleteBuffers(1, &cubeVBO);

        glfwTerminate();
        return 0;
}
```
```glsl
//vertexShader
#version 330 core
layout (location = 0) in vec3 aPos;
layout (std140) uniform Matrices{
        mat4 project;
        mat4 view;
};

uniform mat4 model;

void main(){
        gl_Position=project*view*model*vec4(aPos,1.0);
}
```
```glsl
//fragmentShader
#version 330 core
out vec4 FragColor;

void main(){
        FragColor=vec4(1.0,0.0,0.0,1.0);
}
```
```glsl
//fragmentShader2
#version 330 core
out vec4 FragColor;

void main(){
        FragColor=vec4(0.0,1.0,0.0,1.0);
}
```
```glsl
//fragmentShader3
#version 330 core
out vec4 FragColor;

void main(){
        FragColor=vec4(0.0,0.0,1.0,1.0);
}
```
```glsl
//fragmentShader4
#version 330 core
out vec4 FragColor;

void main(){
        FragColor=vec4(1.0,1.0,0.0,1.0);
}
```
![BQACAgUAAyEGAASHRsPbAAEWLTFqP4VIpFRG3XBLxUrb4tKgvbDfAAPPJgACTTkBVueYdq8u36mRPAQ.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWLTFqP4VIpFRG3XBLxUrb4tKgvbDfAAPPJgACTTkBVueYdq8u36mRPAQ.png)


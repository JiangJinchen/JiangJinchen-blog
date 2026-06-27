---
title: Stencil Buffer
published: 2026-06-27
description: 'Learn OpenGL 第四章第二节'
image: ''
tags: [OpenGL]
category: '学习笔记/OpenGL'
draft: false 
lang: 'zh'
---
# 模板缓冲基本原理
模板缓冲为**8位整型**缓冲区，每个像素对应一个模板数值。开发者可自定义写入任意模板值，片段渲染时，GPU根据**当前片段模板值**与**缓冲存储模板值**的比对规则，选择性保留或丢弃当前片元，实现区域遮罩、轮廓描边、镜面特效等自定义渲染效果。
# 模板缓冲创建规则
- OpenGL 规范要求窗口必须配套模板缓冲资源。
- **GLFW** 会**自动创建模板缓冲**，开发者无需手动申请、创建显存资源。
- 部分其他窗口库不自动创建，需要开发者手动配置并创建模板缓冲。
# 模板测试流程
模板测试核心逻辑：**先写入模板遮罩，再根据遮罩筛选片段**，标准流程如下：
1. 开启模板缓冲写入权限；
2. 渲染遮罩物体，根据规则更新模板缓冲对应像素的模板值；
3. 关闭模板缓冲写入权限，锁定遮罩数据；
4. 渲染其他物体，根据已固定的模板缓冲数值，筛选、丢弃或保留指定片元，实现局部渲染控制。
# 模板测试执行顺序
渲染管线顺序：**模板测试 → 深度测试**，模板测试优先执行。
# 模板测试常用指令
```c
// 开启模板测试（默认关闭）
glEnable(GL_STENCIL_TEST);

// 清空模板缓冲（帧渲染前搭配颜色、深度缓冲一起清空）
glClear(GL_STENCIL_BUFFER_BIT);

// 开启模板缓冲写入（允许修改模板值）
glStencilMask(0xff);

// 禁用模板缓冲写入（锁定模板值，只读）
glStencilMask(0x00);
```
**掩码原理**：`glStencilMask` 基于位运算生效，传入的掩码值会与即将写入缓冲的模板值进行 **AND** 与运算，控制模板值写入权限。
# 模板比对函数 glStencilFunc
## 函数原型参数
`glStencilFunc(func, ref, mask)`
- **func**：比较规则，定义当前片元模板值与参考值的比对逻辑（大于、小于、等于、不等于等）。
- **ref**：参考值，用于和模板缓冲内存储数值做比对的基准数值。
- **mask**：运算掩码，会分别对缓冲模板值和参考值做位与运算，运算结果再执行 func 比对逻辑。
# 模板更新规则 glStencilOp
## 函数原型参数
`glStencilOp(sfail, dpfail, dppass)`
- **sfail**：模板测试失败时的更新策略。
- **dpfail**：模板测试通过，但深度测试失败时的更新策略。
- **dppass**：模板测试通过，且深度测试通过时的更新策略。
三个参数分别对应三种渲染判定结果下，模板缓冲的更新策略：
- **sfail**：模板测试失败
- **dpfail**：模板测试通过，但深度测试失败
- **dppass**：模板测试通过，且深度测试通过
## 模板更新可选行为
- **GL_KEEP**：保留当前模板值，不做修改
- **GL_ZERO**：将当前模板值清零
- **GL_REPLACE**：使用 `ref` 参考值替换当前模板值
- **GL_INCR**：模板值小于最大值则自增1，达到最大值后不再变化
- **GL_INCR_WRAP**：模板值自增1，超出最大值后归零循环
- **GL_DECR**：模板值大于最小值则自减1，达到最小值后不再变化
- **GL_DECR_WRAP**：模板值自减1，小于0后设为最大值循环
- **GL_INVERT**：对当前模板值按位翻转

# example1: 物体轮廓
*实现思路*：启用模板写入；设置模板函数以及模板写入规则：模板函数设为`GL_ALWAYS`（保证物体所覆盖的所有片元都通过模板测试，都能写入模板缓冲），并且渲染时将`1`写入模板缓冲；渲染物体；禁用模板写入以及深度测试（禁用深度测试的原因是：当一个物体显示轮廓时，表明它是被选中的，那么就不应该有其他的物体遮挡它，包括它周围的轮廓）；将物体放大一些；使用不同的片段着色器，使用轮廓颜色渲染放大后的物体，且当且仅当模板值不等于`1`的时候才绘制（这样就只用轮廓颜色绘制了放大的部分）；再次启用模板写入和深度测试（还原，避免修改后续的绘制）。
*流程*：初始化全局状态：开启深度测试、设置深度测试函数（`GL_LESS`）、开启模板测试、设置模板测试函数（初始时模板缓冲中的值都为`0`，而初始时所有物体都想要绘制，比如不需要描边的平面，所以他们要想通过模板测试，模板测试的条件必须是模板值！=`1`）、设置模板写入规则（只有当深度测试和模板测试都通过时才写入）；绘制平面，关闭模板写入；绘制物体，`first pass`中正常绘制（设置模板测试函数，所有片元都通过模板测试）并写入模板（则有物体存在的地方，模板值都变成`1`），`second pass`中绘制轮廓，把物体放大一些，关闭模板写入，设置模板测试函数（当且仅当模板值不等于`1`时绘制，这样绘制的就是放大的部分）并关闭深度测试。
![BQACAgUAAyEGAASHRsPbAAEWKzJqP2qVjJZjgHCvctcewI9AEvJW1gACgyQAAk05AVY7PnvealZIaDwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWKzJqP2qVjJZjgHCvctcewI9AEvJW1gACgyQAAk05AVY7PnvealZIaDwE.png)
```c
//main.cpp
#define STB_IMAGE_IMPLEMENTATION
#include <glad/glad.h>
#include <GLFW/glfw3.h>
#include <stb_image.h>

#include <glm/glm.hpp>
#include <glm/gtc/matrix_transform.hpp>
#include <glm/gtc/type_ptr.hpp>

#include <myShader.h>
#include <myCamera.h>
#include <Model.h>

#include <iostream>

const unsigned int SCR_WIDTH = 800;
const unsigned int SCR_HEIGHT = 400;

Camera camera(glm::vec3(0.0f, 0.0f, 3.0f));
float lastX = (float)SCR_WIDTH / 2.0;
float lastY = (float)SCR_HEIGHT / 2.0;
bool firstCamera = true;

float deltaTime = 0.0f;
float lastFrame = 0.0f;

void framebuffer_size_callback(GLFWwindow* window, int width, int height) {
        glViewport(0, 0, width, height);
}
void processInput(GLFWwindow* window) {
        if (glfwGetKey(window, GLFW_KEY_ESCAPE)) {
                glfwSetWindowShouldClose(window, true);
        }
        if (glfwGetKey(window, GLFW_KEY_W)) {
                camera.ProcessKeyboard(FORWARD, deltaTime);
        }
        if (glfwGetKey(window, GLFW_KEY_S)) {
                camera.ProcessKeyboard(BACKWARD, deltaTime);
        }
        if (glfwGetKey(window, GLFW_KEY_A)) {
                camera.ProcessKeyboard(LEFT, deltaTime);
        }
        if (glfwGetKey(window, GLFW_KEY_D)) {
                camera.ProcessKeyboard(RIGHT, deltaTime);
        }
}
void processMovement(GLFWwindow* window, double xpos, double ypos) {
        if (firstCamera) {
                lastX = static_cast<float>(xpos);
                lastY = static_cast<float>(ypos);
                firstCamera = false;
        }
        float xoffset = static_cast<float>(xpos) - lastX;
        float yoffset = lastY - static_cast<float>(ypos);
        lastX = static_cast<float>(xpos);
        lastY = static_cast<float>(ypos);
        camera.ProcessMouseMovement(xoffset, yoffset);
}
void processScroll(GLFWwindow* window, double xoffset, double yoffset) {
        camera.ProcessScroll(static_cast<float>(yoffset));
}
unsigned int loadTexture(const char* path) {
        unsigned int texture;
        glGenTextures(1, &texture);

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
                glBindTexture(GL_TEXTURE_2D, texture);

                glTexImage2D(GL_TEXTURE_2D, 0, format, width, height, 0, format, GL_UNSIGNED_BYTE, data);
                glGenerateMipmap(GL_TEXTURE_2D);

                glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_REPEAT);
                glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_REPEAT);
                glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR_MIPMAP_LINEAR);
                glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
        }
        else {
                cout << "failed to load tetxure" << endl;
        }
        stbi_image_free(data);

        return texture;
}
int main() {
        glfwInit();
        glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 3);
        glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 3);
        glfwWindowHint(GLFW_OPENGL_PROFILE, GLFW_OPENGL_CORE_PROFILE);

        GLFWwindow* window = glfwCreateWindow(SCR_WIDTH, SCR_HEIGHT, "learnOpenGL", NULL, NULL);

        if (window == NULL) {
                cout << "failed to create GLFW window" << endl;
                glfwTerminate();
                return -1;
        }

        glfwMakeContextCurrent(window);
        glfwSetFramebufferSizeCallback(window, framebuffer_size_callback);
        glfwSetCursorPosCallback(window, processMovement);
        glfwSetScrollCallback(window, processScroll);

        glfwSetInputMode(window, GLFW_CURSOR, GLFW_CURSOR_DISABLED);

        if (!gladLoadGLLoader(GLADloadproc(glfwGetProcAddress))) {
                cout << "failed to initialize glad" << endl;
                glfwTerminate();
                return -1;
        }

        stbi_set_flip_vertically_on_load(true);

        glEnable(GL_DEPTH_TEST);
        glDepthFunc(GL_LESS);
        glEnable(GL_STENCIL_TEST);
        glStencilFunc(GL_NOTEQUAL, 1, 0xFF);
        glStencilOp(GL_KEEP, GL_KEEP, GL_REPLACE);//定义模板写入的规则

        Shader shader("src/Shader/vertexShader.txt", "src/Shader/fragmentShader.txt");
        Shader shaderSingleColor("src/Shader/vertexShader.txt", "src/Shader/shaderSingleColor.txt");
        float cubeVertices[] = {
                -0.5f, -0.5f, -0.5f,  0.0f, 0.0f,
                 0.5f, -0.5f, -0.5f,  1.0f, 0.0f,
                 0.5f,  0.5f, -0.5f,  1.0f, 1.0f,
                 0.5f,  0.5f, -0.5f,  1.0f, 1.0f,
                -0.5f,  0.5f, -0.5f,  0.0f, 1.0f,
                -0.5f, -0.5f, -0.5f,  0.0f, 0.0f,

                -0.5f, -0.5f,  0.5f,  0.0f, 0.0f,
                 0.5f, -0.5f,  0.5f,  1.0f, 0.0f,
                 0.5f,  0.5f,  0.5f,  1.0f, 1.0f,
                 0.5f,  0.5f,  0.5f,  1.0f, 1.0f,
                -0.5f,  0.5f,  0.5f,  0.0f, 1.0f,
                -0.5f, -0.5f,  0.5f,  0.0f, 0.0f,

                -0.5f,  0.5f,  0.5f,  1.0f, 0.0f,
                -0.5f,  0.5f, -0.5f,  1.0f, 1.0f,
                -0.5f, -0.5f, -0.5f,  0.0f, 1.0f,
                -0.5f, -0.5f, -0.5f,  0.0f, 1.0f,
                -0.5f, -0.5f,  0.5f,  0.0f, 0.0f,
                -0.5f,  0.5f,  0.5f,  1.0f, 0.0f,

                 0.5f,  0.5f,  0.5f,  1.0f, 0.0f,
                 0.5f,  0.5f, -0.5f,  1.0f, 1.0f,
                 0.5f, -0.5f, -0.5f,  0.0f, 1.0f,
                 0.5f, -0.5f, -0.5f,  0.0f, 1.0f,
                 0.5f, -0.5f,  0.5f,  0.0f, 0.0f,
                 0.5f,  0.5f,  0.5f,  1.0f, 0.0f,

                -0.5f, -0.5f, -0.5f,  0.0f, 1.0f,
                 0.5f, -0.5f, -0.5f,  1.0f, 1.0f,
                 0.5f, -0.5f,  0.5f,  1.0f, 0.0f,
                 0.5f, -0.5f,  0.5f,  1.0f, 0.0f,
                -0.5f, -0.5f,  0.5f,  0.0f, 0.0f,
                -0.5f, -0.5f, -0.5f,  0.0f, 1.0f,

                -0.5f,  0.5f, -0.5f,  0.0f, 1.0f,
                 0.5f,  0.5f, -0.5f,  1.0f, 1.0f,
                 0.5f,  0.5f,  0.5f,  1.0f, 0.0f,
                 0.5f,  0.5f,  0.5f,  1.0f, 0.0f,
                -0.5f,  0.5f,  0.5f,  0.0f, 0.0f,
                -0.5f,  0.5f, -0.5f,  0.0f, 1.0f
        };

        float planeVertices[] = {
                5.0f, -0.5f,  5.0f,  2.0f, 0.0f,
                -5.0f, -0.5f,  5.0f,  0.0f, 0.0f,
                -5.0f, -0.5f, -5.0f,  0.0f, 2.0f,

                 5.0f, -0.5f,  5.0f,  2.0f, 0.0f,
                -5.0f, -0.5f, -5.0f,  0.0f, 2.0f,
                 5.0f, -0.5f, -5.0f,  2.0f, 2.0f
        };

        unsigned int cubeVAO, cubeVBO;
        glGenVertexArrays(1, &cubeVAO);
        glGenBuffers(1, &cubeVBO);

        glBindVertexArray(cubeVAO);
        glBindBuffer(GL_ARRAY_BUFFER,cubeVBO);
        glBufferData(GL_ARRAY_BUFFER, sizeof(cubeVertices), cubeVertices, GL_STATIC_DRAW);

        glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 5 * sizeof(float), (void*)0);
        glEnableVertexAttribArray(0);

        glVertexAttribPointer(1, 2, GL_FLOAT, GL_FALSE, 5 * sizeof(float), (void*)(3 * sizeof(float)));
        glEnableVertexAttribArray(1);

        glBindVertexArray(0);

        unsigned int planeVAO, planeVBO;
        glGenVertexArrays(1, &planeVAO);
        glGenBuffers(1, &planeVBO);

        glBindVertexArray(planeVAO);
        glBindBuffer(GL_ARRAY_BUFFER,planeVBO);
        glBufferData(GL_ARRAY_BUFFER, sizeof(planeVertices), planeVertices, GL_STATIC_DRAW);
        
        glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 5 * sizeof(float), (void*)0);
        glEnableVertexAttribArray(0);

        glVertexAttribPointer(1, 2, GL_FLOAT, GL_FALSE, 5 * sizeof(float), (void*)(3 * sizeof(float)));
        glEnableVertexAttribArray(1);

        glBindVertexArray(0);

        unsigned int cubeTexture = loadTexture("resources/textures/marble.jpg");
        unsigned int floorTexture = loadTexture("resources/textures/metal.jpg");

        shader.use();
        shader.setInt("texture1", 0);
        shader.setInt("texture2", 1);

        while (!glfwWindowShouldClose(window)) {
                float currentFrame = (float)glfwGetTime();
                deltaTime = currentFrame - lastFrame;
                lastFrame = currentFrame;

                processInput(window);

                glClearColor(0.1f, 0.1f, 0.1f, 1.0f);
                glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT | GL_STENCIL_BUFFER_BIT);

                shader.use();
                //绘制平面
                glStencilMask(0x00);//平面不需要轮廓，所以关闭模板测试

                glBindVertexArray(planeVAO);
                glActiveTexture(GL_TEXTURE1);
                glBindTexture(GL_TEXTURE_2D, floorTexture);
                shader.setInt("useFloorTex", 1);
                shader.setMatrix("model", glm::mat4(1.0f));
                glDrawArrays(GL_TRIANGLES, 0, 6);
                glBindVertexArray(0);

                //绘制箱子
                //1st. render pass,draw object as normal,writing to the stencil buffer
                glStencilFunc(GL_ALWAYS, 1, 0xFF);
                glStencilMask(0xFF);

                glm::mat4 model = glm::mat4(1.0f);
                glm::mat4 view = camera.GetCameraView();
                glm::mat4 project = glm::perspective(glm::radians(camera.Zoom), (float)SCR_WIDTH / (float)SCR_HEIGHT, 0.1f, 100.0f);
                shader.setMatrix("view", view);
                shader.setMatrix("project", project);

                glBindVertexArray(cubeVAO);
                glActiveTexture(GL_TEXTURE0);
                glBindTexture(GL_TEXTURE_2D, cubeTexture);
                shader.setInt("useFloorTex", 0);
                model = glm::translate(model, glm::vec3(-1.0f, 0.0f, -1.0f));
                shader.setMatrix("model", model);
                glDrawArrays(GL_TRIANGLES, 0, 36);

                model = glm::mat4(1.0f);
                model = glm::translate(model, glm::vec3(2.0f, 0.0f, 0.0f));
                shader.setMatrix("model", model);
                glDrawArrays(GL_TRIANGLES, 0, 36);
                
                //绘制轮廓线（即放大后的箱子，且通过模板测试）
                //2nd. render pass:now draw slightly scaled versions of the objects
                //disable stencil writing and depth test
                shaderSingleColor.use();
                glStencilFunc(GL_NOTEQUAL, 1, 0xFF);
                glStencilMask(0x00);
                glDisable(GL_DEPTH_TEST);
                
                model = glm::mat4(1.0f);
                model = glm::translate(model, glm::vec3(-1.0f, 0.0f, -1.0f));
                model = glm::scale(model, glm::vec3(1.1f));
                shaderSingleColor.setMatrix("model", model);
                shaderSingleColor.setMatrix("view", view);
                shaderSingleColor.setMatrix("project", project);
                glDrawArrays(GL_TRIANGLES, 0, 36);

                model = glm::mat4(1.0f);
                model = glm::translate(model, glm::vec3(2.0f, 0.0f, 0.0f));
                model = glm::scale(model, glm::vec3(1.1f));
                shaderSingleColor.setMatrix("model", model);
                glDrawArrays(GL_TRIANGLES, 0, 36);

                //绘制完毕，还原状态
                glStencilMask(0xFF);
                glStencilFunc(GL_ALWAYS, 0, 0xFF);
                glEnable(GL_DEPTH_TEST);

                glBindVertexArray(0);

                glfwSwapBuffers(window);
                glfwPollEvents();
        }
        glDeleteVertexArrays(1, &cubeVAO);
        glDeleteVertexArrays(1, &planeVAO);
        glDeleteBuffers(1, &cubeVBO);
        glDeleteBuffers(1, &planeVBO);

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
        TexCoords=aTexCoords;
        gl_Position=project*view*model*vec4(aPos,1.0);
}
```
```glsl
//fragmentShader
#version 330 core
in vec2 TexCoords;
out vec4 FragColor;
uniform sampler2D texture1;
uniform sampler2D texture2;

uniform int useFloorTex;
void main(){
        if(useFloorTex==1){
                FragColor=texture(texture2,TexCoords);
        }else{
                FragColor=texture(texture1,TexCoords);
        }
}
```
```glsl
//shaderSingleColor
#version 330 core
out vec4 FragColor;
void main(){
        FragColor=vec4(0.04,0.28,0.26,1.0);
}
```
**对之前的背包模型进行描边（即把物体轮廓与自定义模型类结合起来）**
*思路*：拆解物体轮廓的实现，对一个待添加轮廓的模型来说，无非是两次绘制，第一次使用正常着色器绘制正常大小的模型，第二次使用轮廓着色器绘制放大一些的模型。而自定义模型类已经提供了`Draw`函数，允许指定绘制用的着色器来绘制一个模型。所以上述两次绘制的操作就可以通过直接调用这个函数，并传入不同的着色器实现。那么我们要做的（或者说比较麻烦的）是如何做好这两次绘制之间状态设置的工作。首先是全局状态设置；然后是第一次绘制前状态的设置（设置`stencil buffer`写入规则、开启`stencil buffer`的写入）；第一次绘制完，需要修改模型`model`矩阵，将其放大一丢丢，然后进行状态设置（关闭`stencil buffer`的写入，设置`stencil test`的规则、关闭深度测试）；最后是第二次绘制完，需要恢复状态（开启深度测试、重置`stencil buffer`写入规则、开启`stencil buffer`的写入）。
![BQACAgUAAyEGAASHRsPbAAEWKzxqP2sOfiRUx0jEVy0kzNUw9ZxNPAACkCQAAk05AVbetsoxhh2ggjwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWKzxqP2sOfiRUx0jEVy0kzNUw9ZxNPAACkCQAAk05AVbetsoxhh2ggjwE.png)
```c
//main.cpp
#define STB_IMAGE_IMPLEMENTATION
#include <glad/glad.h>
#include <GLFW/glfw3.h>
#include <stb_image.h>

#include <glm/glm.hpp>
#include <glm/gtc/matrix_transform.hpp>
#include <glm/gtc/type_ptr.hpp>

#include <myShader.h>
#include <myCamera.h>
#include <Model.h>

#include <iostream>

const unsigned int SCR_WIDTH = 800;
const unsigned int SCR_HEIGHT = 400;
#define NR_POINT_LIGHTS 2

Camera camera(glm::vec3(0.0f, 0.0f, 3.0f));
float lastX = (float)SCR_WIDTH / 2.0;
float lastY = (float)SCR_HEIGHT / 2.0;
bool firstCamera = true;

float deltaTime = 0.0f;
float lastFrame = 0.0f;

void framebuffer_size_callback(GLFWwindow* window, int width, int height) {
        glViewport(0, 0, width, height);
}
void processInput(GLFWwindow* window) {
        if (glfwGetKey(window, GLFW_KEY_ESCAPE)) {
                glfwSetWindowShouldClose(window, true);
        }
        if (glfwGetKey(window, GLFW_KEY_W)) {
                camera.ProcessKeyboard(FORWARD, deltaTime);
        }
        if (glfwGetKey(window, GLFW_KEY_S)) {
                camera.ProcessKeyboard(BACKWARD, deltaTime);
        }
        if (glfwGetKey(window, GLFW_KEY_A)) {
                camera.ProcessKeyboard(LEFT, deltaTime);
        }
        if (glfwGetKey(window, GLFW_KEY_D)) {
                camera.ProcessKeyboard(RIGHT, deltaTime);
        }
}
void processMovement(GLFWwindow* window, double xpos, double ypos) {
        if (firstCamera) {
                lastX = static_cast<float>(xpos);
                lastY = static_cast<float>(ypos);
                firstCamera = false;
        }
        float xoffset = static_cast<float>(xpos) - lastX;
        float yoffset = lastY - static_cast<float>(ypos);
        lastX = static_cast<float>(xpos);
        lastY = static_cast<float>(ypos);
        camera.ProcessMouseMovement(xoffset, yoffset);
}
void processScroll(GLFWwindow* window, double xoffset, double yoffset) {
        camera.ProcessScroll(static_cast<float>(yoffset));
}
unsigned int loadTexture(const char* path) {
        unsigned int texture;
        glGenTextures(1, &texture);

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
                glBindTexture(GL_TEXTURE_2D, texture);

                glTexImage2D(GL_TEXTURE_2D, 0, format, width, height, 0, format, GL_UNSIGNED_BYTE, data);
                glGenerateMipmap(GL_TEXTURE_2D);

                glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_REPEAT);
                glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_REPEAT);
                glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR_MIPMAP_LINEAR);
                glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
        }
        else {
                cout << "failed to load tetxure" << endl;
        }
        stbi_image_free(data);

        return texture;
}
int main() {
        glfwInit();
        glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 3);
        glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 3);
        glfwWindowHint(GLFW_OPENGL_PROFILE, GLFW_OPENGL_CORE_PROFILE);

        GLFWwindow* window = glfwCreateWindow(SCR_WIDTH, SCR_HEIGHT, "learnOpenGL", NULL, NULL);

        if (window == NULL) {
                cout << "failed to create GLFW window" << endl;
                glfwTerminate();
                return -1;
        }

        glfwMakeContextCurrent(window);
        glfwSetFramebufferSizeCallback(window, framebuffer_size_callback);
        glfwSetCursorPosCallback(window, processMovement);
        glfwSetScrollCallback(window, processScroll);

        glfwSetInputMode(window, GLFW_CURSOR, GLFW_CURSOR_DISABLED);

        if (!gladLoadGLLoader(GLADloadproc(glfwGetProcAddress))) {
                cout << "failed to initialize glad" << endl;
                glfwTerminate();
                return -1;
        }

        stbi_set_flip_vertically_on_load(true);

        glEnable(GL_DEPTH_TEST);
        glDepthFunc(GL_LESS);
        glEnable(GL_STENCIL_TEST);
        glStencilFunc(GL_NOTEQUAL, 1, 0xFF);
        glStencilOp(GL_KEEP, GL_KEEP, GL_REPLACE);

        Shader shader("src/Shader/vertexShader.txt", "src/Shader/fragmentShader.txt");
        Shader shaderSingleColor("src/Shader/vertexShader.txt", "src/Shader/shaderSingleColor.txt");
        Shader lightShader("src/Shader/vertexShader.txt", "src/Shader/lightFragmentShader.txt");

        Model myModel("resources/objects/backpack/backpack.obj");

        //光源立方体的顶点信息
        float vertices[] = {
                -0.5f, -0.5f, -0.5f,  0.0f,  0.0f, -1.0f,  0.0f,  0.0f,
                 0.5f, -0.5f, -0.5f,  0.0f,  0.0f, -1.0f,  1.0f,  0.0f,
                 0.5f,  0.5f, -0.5f,  0.0f,  0.0f, -1.0f,  1.0f,  1.0f,
                 0.5f,  0.5f, -0.5f,  0.0f,  0.0f, -1.0f,  1.0f,  1.0f,
                -0.5f,  0.5f, -0.5f,  0.0f,  0.0f, -1.0f,  0.0f,  1.0f,
                -0.5f, -0.5f, -0.5f,  0.0f,  0.0f, -1.0f,  0.0f,  0.0f,

                -0.5f, -0.5f,  0.5f,  0.0f,  0.0f,  1.0f,  0.0f,  0.0f,
                 0.5f, -0.5f,  0.5f,  0.0f,  0.0f,  1.0f,  1.0f,  0.0f,
                 0.5f,  0.5f,  0.5f,  0.0f,  0.0f,  1.0f,  1.0f,  1.0f,
                 0.5f,  0.5f,  0.5f,  0.0f,  0.0f,  1.0f,  1.0f,  1.0f,
                -0.5f,  0.5f,  0.5f,  0.0f,  0.0f,  1.0f,  0.0f,  1.0f,
                -0.5f, -0.5f,  0.5f,  0.0f,  0.0f,  1.0f,  0.0f,  0.0f,

                -0.5f,  0.5f,  0.5f, -1.0f,  0.0f,  0.0f,  1.0f,  0.0f,
                -0.5f,  0.5f, -0.5f, -1.0f,  0.0f,  0.0f,  1.0f,  1.0f,
                -0.5f, -0.5f, -0.5f, -1.0f,  0.0f,  0.0f,  0.0f,  1.0f,
                -0.5f, -0.5f, -0.5f, -1.0f,  0.0f,  0.0f,  0.0f,  1.0f,
                -0.5f, -0.5f,  0.5f, -1.0f,  0.0f,  0.0f,  0.0f,  0.0f,
                -0.5f,  0.5f,  0.5f, -1.0f,  0.0f,  0.0f,  1.0f,  0.0f,

                 0.5f,  0.5f,  0.5f,  1.0f,  0.0f,  0.0f,  1.0f,  0.0f,
                 0.5f,  0.5f, -0.5f,  1.0f,  0.0f,  0.0f,  1.0f,  1.0f,
                 0.5f, -0.5f, -0.5f,  1.0f,  0.0f,  0.0f,  0.0f,  1.0f,
                 0.5f, -0.5f, -0.5f,  1.0f,  0.0f,  0.0f,  0.0f,  1.0f,
                 0.5f, -0.5f,  0.5f,  1.0f,  0.0f,  0.0f,  0.0f,  0.0f,
                 0.5f,  0.5f,  0.5f,  1.0f,  0.0f,  0.0f,  1.0f,  0.0f,

                -0.5f, -0.5f, -0.5f,  0.0f, -1.0f,  0.0f,  0.0f,  1.0f,
                 0.5f, -0.5f, -0.5f,  0.0f, -1.0f,  0.0f,  1.0f,  1.0f,
                 0.5f, -0.5f,  0.5f,  0.0f, -1.0f,  0.0f,  1.0f,  0.0f,
                 0.5f, -0.5f,  0.5f,  0.0f, -1.0f,  0.0f,  1.0f,  0.0f,
                -0.5f, -0.5f,  0.5f,  0.0f, -1.0f,  0.0f,  0.0f,  0.0f,
                -0.5f, -0.5f, -0.5f,  0.0f, -1.0f,  0.0f,  0.0f,  1.0f,

                -0.5f,  0.5f, -0.5f,  0.0f,  1.0f,  0.0f,  0.0f,  1.0f,
                 0.5f,  0.5f, -0.5f,  0.0f,  1.0f,  0.0f,  1.0f,  1.0f,
                 0.5f,  0.5f,  0.5f,  0.0f,  1.0f,  0.0f,  1.0f,  0.0f,
                 0.5f,  0.5f,  0.5f,  0.0f,  1.0f,  0.0f,  1.0f,  0.0f,
                -0.5f,  0.5f,  0.5f,  0.0f,  1.0f,  0.0f,  0.0f,  0.0f,
                -0.5f,  0.5f, -0.5f,  0.0f,  1.0f,  0.0f,  0.0f,  1.0f
        };

        //光源立方体的位置信息
        glm::vec3 pointLightPositions[] = {
                glm::vec3(-2.0f,0.2f,0.5f),
                glm::vec3(3.0f,0.2f,-0.5f)
        };

        unsigned int lightVAO, lightVBO;
        glGenVertexArrays(1, &lightVAO);
        glGenBuffers(1, &lightVBO);

        glBindVertexArray(lightVAO);
        glBindBuffer(GL_ARRAY_BUFFER, lightVBO);
        
        glBufferData(GL_ARRAY_BUFFER, sizeof(vertices), vertices, GL_STATIC_DRAW);
        glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 8 * sizeof(float), (void*)0);
        glEnableVertexAttribArray(0);

        glBindVertexArray(0);

        shader.use();
        shader.setFloat("material.shininess", 32.0f);

        shader.setVec3("dirLight.direction", glm::vec3(-0.2f, -1.0f, -0.3f));
        shader.setVec3("dirLight.ambient", glm::vec3(0.05f, 0.05f, 0.05f));
        shader.setVec3("dirLight.diffuse", glm::vec3(0.4f, 0.4f, 0.4f));
        shader.setVec3("dirLight.specular", glm::vec3(0.5f, 0.5f, 0.5f));

        shader.setVec3("pointLights[0].position", pointLightPositions[0]);
        shader.setVec3("pointLights[0].ambient", glm::vec3(0.5f));
        shader.setVec3("pointLights[0].diffuse", glm::vec3(0.8f));
        shader.setVec3("pointLights[0].specular", glm::vec3(1.0f));
        shader.setFloat("pointLights[0].constant", 1.0f);
        shader.setFloat("pointLights[0].linear", 0.09f);
        shader.setFloat("pointLights[0].quadratic", 0.32f);

        shader.setVec3("pointLights[1].position", pointLightPositions[1]);
        shader.setVec3("pointLights[1].ambient", glm::vec3(0.5f));
        shader.setVec3("pointLights[1].diffuse", glm::vec3(0.8f));
        shader.setVec3("pointLights[1].specular", glm::vec3(1.0f));
        shader.setFloat("pointLights[1].constant", 1.0f);
        shader.setFloat("pointLights[1].linear", 0.09f);
        shader.setFloat("pointLights[1].quadratic", 0.32f);

        while (!glfwWindowShouldClose(window)) {
                float currentFrame = (float)glfwGetTime();
                deltaTime = currentFrame - lastFrame;
                lastFrame = currentFrame;

                processInput(window);

                glClearColor(0.1f, 0.1f, 0.1f, 1.0f);
                glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT | GL_STENCIL_BUFFER_BIT);

                //绘制物体
                //first pass
                glStencilFunc(GL_ALWAYS, 1, 0xFF);
                glStencilMask(0xFF);

                shader.use();
                glm::mat4 model;
                model = glm::translate(model, glm::vec3(0.0f));
                model = glm::scale(model, glm::vec3(1.0f));
                shader.setMatrix("model", model);
                glm::mat4 view = camera.GetCameraView();
                shader.setMatrix("view", view);
                glm::mat4 project = glm::perspective(glm::radians(camera.Zoom), (float)SCR_WIDTH / (float)SCR_HEIGHT, 0.1f, 100.0f);
                shader.setMatrix("project", project);
                shader.setVec3("viewPos", camera.Position);
                myModel.Draw(shader);

                //second pass
                glStencilFunc(GL_NOTEQUAL, 1, 0xFF);
                glStencilMask(0x00);
                glDisable(GL_DEPTH_TEST);
                
                shaderSingleColor.use();
                model = glm::mat4(1.0f);
                model = glm::translate(model, glm::vec3(0.0f));
                model = glm::scale(model, glm::vec3(1.1f));
                shaderSingleColor.setMatrix("model", model);
                shaderSingleColor.setMatrix("view", view);
                shaderSingleColor.setMatrix("project", project);
                myModel.Draw(shaderSingleColor);

                glStencilMask(0xFF);
                glStencilFunc(GL_ALWAYS, 0, 0xFF);
                glEnable(GL_DEPTH_TEST);

                //绘制光源立方体
                /*lightShader.use();
                glBindVertexArray(lightVAO);
                for (int i = 0; i < NR_POINT_LIGHTS; i++) {
                        model = glm::mat4(1.0f);
                        model = glm::translate(model, pointLightPositions[i]);
                        model = glm::scale(model, glm::vec3(0.5f));
                        lightShader.setMatrix("model", model);

                        lightShader.setMatrix("view", view);
                        lightShader.setMatrix("project", project);

                        glDrawArrays(GL_TRIANGLES, 0, 36);
                }
                glBindVertexArray(0);*/

                glfwSwapBuffers(window);
                glfwPollEvents();
        }
        

        glfwTerminate();
        return 0;
}
```

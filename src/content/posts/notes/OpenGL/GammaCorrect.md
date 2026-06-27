---
title: Gamma Correct
published: 2026-06-27
description: 'Learn OpenGL 第五章第二节'
image: ''
tags: [OpenGL]
category: '学习笔记/OpenGL'
draft: false 
lang: 'zh'
---
# Gamma校正的核心原因
人眼对暗部的感知能力远强于亮部。计算机颜色仅有256个色阶，若亮色与暗色数值均匀分布，会出现明显精度分配问题：亮色部分精度过剩、暗色部分精度严重不足，暗部色彩过渡断层、细节丢失。
Gamma校正通过数值映射优化色阶分布：将原颜色值 `0-0.5` 的区间扩展至 `0-0.73`，同时将大于 `0.5` 的亮部区间压缩至原有一半左右。在不增加数据量、不占用额外显存的前提下，大幅提升人眼敏感的暗部颜色可辨识精度，贴合人眼视觉特性。
# Gamma值固定为2.2的原因与sRGB空间
老式CRT阴极射线管显示器的输入亮度与屏幕实际输出亮度呈**指数幂次关系**，默认指数为2.2。简单来说：显示器会对输入图像的亮度执行 `pow(2.2)` 运算后再输出画面。
为抵消显示器的幂次失真，图像存储阶段会预先做一次 `pow(1/2.2)` 伽马校正。图像输出时，两次幂次运算相互抵消，最终画面呈现线性、真实的亮度效果。
因此伽马校正指数需与显示器指数**互为倒数**。2.2是绝大多数显示器的通用Gamma值，基于`gamma=2.2 `校准的颜色空间，即为**sRGB颜色空间**（线性图像经 `pow(1/2.2)` 转换得到的非线性空间）。
# 不做Gamma校正的渲染缺陷
计算机图形学的所有光照、混合、插值算法，**均基于线性颜色空间计算**。
日常读取的图片素材、纹理资源，默认是适配显示器输出的**Gamma非线性空间**。若直接在非线性Gamma空间中执行光照渲染、颜色运算，会出现亮度偏差、光照失真、色彩不准确等错误效果。
# Gamma校正的实现
Gamma校正的核心原则：**仅在渲染最后一步执行**，将线性空间转为非线性输出空间。若提前校正，后续所有渲染运算都会基于错误的非线性颜色值计算，结果全部失真。
## 两种实现方式
**方式一：使用OpenGL内建sRGB帧缓冲**
多帧缓冲渲染场景中，可灵活控制校正时机：多个帧缓冲之间的中间渲染结果，可始终保留在线性空间，仅对最终输出至显示器的帧缓冲开启sRGB校正，避免中间计算失真。
**方式二：片元着色器手动校正**
需在每一个参与最终输出的片元着色器最后一步执行Gamma校正。若场景存在多个物体、多个自定义片段着色器，需要逐个添加校正代码，操作繁琐且易遗漏。
最优简化方案：新增全局后处理阶段，统一在后处理绘制的四边形着色器中执行一次Gamma校正，全局生效，无需修改各个物体着色器。
# sRGB纹理
sRGB纹理是贴合人眼视觉特性的纹理格式，也是美工编辑贴图的常用空间。这类纹理的亮度值，已经预先执行过一次 `pow(1/2.2)` 伽马校正。
若直接将sRGB纹理当作线性纹理使用，会出现双重校正问题：光照计算基于非线性数值出错，且最终渲染输出会再次执行一次Gamma校正，导致纹理画面整体过亮、严重失真。
## 解决方案
方案一：要求美工在线性空间内制作纹理素材；
方案二：纹理参与渲染计算前，手动执行 `pow(2.2)`，将sRGB非线性纹理还原为线性空间纹理。
手动逐纹理转换繁琐低效，OpenGL提供原生支持：创建纹理时直接声明为 **sRGB** 或**sRGB_ALPHA** 格式，GPU会自动将纹理像素值校正为线性空间，无需手动处理。
# sRGB与非sRGB纹理
并非所有纹理都适配sRGB格式，强行转换会导致纹理数据损坏、渲染异常。
## sRGB空间纹理（存储颜色信息）
漫反射颜色贴图、镜面反射颜色贴图、自发光颜色贴图等，用于记录色彩、亮度的视觉类贴图。
## 非sRGB空间纹理（存储数值信息）
法线贴图、高度图、金属度粗糙度图、光照贴图等，用于渲染计算、存储数学数值的功能性贴图，严禁做Gamma校正转换。
# Gamma校正对光照衰减的影响
光照衰减分为两种常用公式，Gamma校正会彻底改变两者的视觉表现：
## 两种衰减公式
- 二次衰减（物理真实）：`attenuation = 1 / (distance * distance)`，光照强度随距离平方衰减
- 线性衰减：`attenuation = 1 / distance`，光照强度随距离线性衰减
## 无Gamma校正时
最终输出亮度会叠加显示器的2.2次幂运算：
- 二次衰减：`(1/(distance*distance))^2.2`，分母大幅增大，衰减强度过高，灯光快速变暗
- 线性衰减：`(1/distance)^2.2`，视觉效果贴合现实光照规律
## 开启Gamma校正后
视觉效果完全反转：线性衰减的光照效果过弱、不自然；二次函数衰减效果贴合真实物理光照，表现最佳。

# example1:实现gamma校正并对于校正前、校正后的效果
设置gamma校正的状态变量，`gammaEnabled`和`gammaKeyPressed`，检测用户按键行为，赋值`gammaEnabled`，并传递到纹理加载函数和片元着色器。
对于纹理加载函数，新增参数接收`gammaEnabled`，表示是否开启gamma校正。这里使用OpenGL内置函数处理sRGB纹理，在开启gamma校正之后，设置加载纹理的空间为sRGB或SRGB_ALPHA，这样在使用纹理时，OpenGL会自动帮我们转为线性空间。
对于片元着色器，开启/不开启gamma校正仅光照衰减计算不同，未开启gamma校正时采用线性衰减效果更好，开启gamma校正后使用二次函数衰减更好。
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
bool gammaEnabled = false;
bool gammaKeyPressed = false;

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
        if (glfwGetKey(window, GLFW_KEY_B) == GLFW_PRESS && !gammaKeyPressed) {
                gammaEnabled = !gammaEnabled;
                gammaKeyPressed = true;
        }
        if (glfwGetKey(window, GLFW_KEY_B) != GLFW_PRESS) {
                gammaKeyPressed = false;
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
unsigned int loadTexture(const char* path,bool gammaCorrection) {
        unsigned int texture;
        glGenTextures(1, &texture);
        glBindTexture(GL_TEXTURE_2D, texture);

        int width, height, nrChannels;
        unsigned char* data = stbi_load(path, &width, &height, &nrChannels, 0);
        if (data) {
                GLenum internalFormat;
                GLenum dataFormat;
                if (nrChannels == 1) {
                        internalFormat = dataFormat = GL_RED;
                }
                else if (nrChannels == 3) {
                        dataFormat = GL_RGB;
                        internalFormat = gammaCorrection ? GL_SRGB : GL_RGB;
                }
                else if (nrChannels == 4) {
                        dataFormat = GL_RGBA;
                        internalFormat = gammaCorrection ? GL_SRGB_ALPHA : GL_RGBA;
                }
                glTexImage2D(GL_TEXTURE_2D, 0, internalFormat, width, height, 0, dataFormat, GL_UNSIGNED_BYTE, data);
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
        glEnable(GL_BLEND);//如果地板纹理有透明通道则开启混合
        glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);

        float planeVertices[] = {
                // positions            // normals         // texcoords
                 10.0f, -0.5f,  10.0f,  0.0f, 1.0f, 0.0f,  10.0f,  0.0f,
                -10.0f, -0.5f,  10.0f,  0.0f, 1.0f, 0.0f,   0.0f,  0.0f,
                -10.0f, -0.5f, -10.0f,  0.0f, 1.0f, 0.0f,   0.0f, 10.0f,

                 10.0f, -0.5f,  10.0f,  0.0f, 1.0f, 0.0f,  10.0f,  0.0f,
                -10.0f, -0.5f, -10.0f,  0.0f, 1.0f, 0.0f,   0.0f, 10.0f,
                 10.0f, -0.5f, -10.0f,  0.0f, 1.0f, 0.0f,  10.0f, 10.0f
        };

        unsigned int quadVAO, quadVBO;
        glGenVertexArrays(1, &quadVAO);
        glGenBuffers(1, &quadVBO);
        glBindVertexArray(quadVAO);
        glBindBuffer(GL_ARRAY_BUFFER, quadVBO);
        glBufferData(GL_ARRAY_BUFFER, sizeof(planeVertices), planeVertices, GL_STATIC_DRAW);
        glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 8 * sizeof(float), (void*)0);
        glEnableVertexAttribArray(0);
        glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, 8 * sizeof(float), (void*)(3 * sizeof(float)));
        glEnableVertexAttribArray(1);
        glVertexAttribPointer(2, 2, GL_FLOAT, GL_FALSE, 8 * sizeof(float), (void*)(6 * sizeof(float)));
        glEnableVertexAttribArray(2);
        glBindVertexArray(0);

        unsigned int floorTexture = loadTexture("resources/textures/wood.jpg",false);
        unsigned int floorTextureGammaCorrected = loadTexture("resources/textures/wood.jpg",true);

        Shader shader("src/Shader/vertexShader.txt", "src/Shader/fragmentShader.txt");

        shader.use();
        shader.setInt("floorTexture", 0);

        glm::vec3 lightPositions[] = {
                glm::vec3(-3.0f, 0.0f, 0.0f),
                glm::vec3(-1.0f, 0.0f, 0.0f),
                glm::vec3(1.0f, 0.0f, 0.0f),
                glm::vec3(3.0f, 0.0f, 0.0f)
        };
        glm::vec3 lightColors[] = {
                glm::vec3(0.25),
                glm::vec3(0.50),
                glm::vec3(0.75),
                glm::vec3(1.00)
        };
        glUniform3fv(glGetUniformLocation(shader.ID, "lightPositions"), 4, &lightPositions[0][0]);//一次性上传4个vec3
        glUniform3fv(glGetUniformLocation(shader.ID, "lightColors"), 4, &lightColors[0][0]);//一次性上传4个vec3

        while (!glfwWindowShouldClose(window)) {
                float currentFrame = (float)glfwGetTime();
                deltaTime = currentFrame - lastFrame;
                lastFrame = currentFrame;

                processInput(window);

                glClearColor(0.1, 0.1, 0.1, 1.0);
                glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

                shader.use();
                glm::mat4 view = camera.GetCameraView();
                glm::mat4 projection = glm::perspective(glm::radians(camera.Zoom), (float)SCR_WIDTH / (float)SCR_HEIGHT, 1.0f, 100.0f);
                shader.setMat4("view", view);
                shader.setMat4("projection", projection);
                shader.setVec3("viewPos", camera.Position);
                shader.setInt("gamma", gammaEnabled);

                glBindVertexArray(quadVAO);
                glActiveTexture(GL_TEXTURE0);
                glBindTexture(GL_TEXTURE_2D, gammaEnabled ? floorTextureGammaCorrected : floorTexture);
                glDrawArrays(GL_TRIANGLES, 0, 6);
                glBindVertexArray(0);

                //cout << (gammaEnabled ? "Gamma Enabled" : "Gamma DisEnabled") << endl;
                
                glfwSwapBuffers(window);
                glfwPollEvents();
        }
        glDeleteVertexArrays(1, &quadVAO);
        glDeleteBuffers(1, &quadVBO);
        glfwTerminate();
        return 0;
}
```
```glsl
//vertexShader
#version 330 core
layout (location = 0) in vec3 aPos;
layout (location = 1) in vec3 aNormal;
layout (location = 2) in vec2 aTexCoords;

out VS_OUT{
        vec3 FragPos;
        vec3 Normal;
        vec2 TexCoords;
} vs_out;

uniform mat4 view;
uniform mat4 projection;

void main(){
        gl_Position=projection*view*vec4(aPos,1.0);
        vs_out.FragPos=aPos;
        vs_out.Normal=aNormal;
        vs_out.TexCoords=aTexCoords;
}
```
```glsl
//fragmentShader
#version 330 core
out vec4 FragColor;
in VS_OUT{
        vec3 FragPos;
        vec3 Normal;
        vec2 TexCoords;
} fs_in;
uniform sampler2D floorTexture;
uniform vec3 lightPositions[4];
uniform vec3 lightColors[4];
uniform vec3 viewPos;
uniform bool gamma;

vec3 BlinnPhong(vec3 normal,vec3 FragPos,vec3 lightPos,vec3 lightColor){
        vec3 worldNormal=normalize(normal);
        vec3 worldLight=normalize(lightPos-FragPos);
        vec3 worldView=normalize(viewPos-FragPos);

        float diff=max(dot(worldNormal,worldLight),0.0);
        vec3 diffuse=lightColor*diff;

        vec3 halfDir=normalize(worldLight+worldView);
        float spec=pow(max(dot(worldNormal,halfDir),0.0),64.0);
        vec3 specular=lightColor*spec;

        float distance=length(lightPos-FragPos);
        float attenuation=1.0/(gamma?distance*distance:distance);

        return (diffuse+specular)*attenuation;
}
void main(){
        vec3 color=texture(floorTexture,fs_in.TexCoords).rgb;
        vec3 ambient=0.05*color;
        vec3 lighting=vec3(0.0);//不能直接赋值0.0，会报编译错误
        for(int i=0;i<4;i++){
                lighting+=BlinnPhong(fs_in.Normal,fs_in.FragPos,lightPositions[i],lightColors[i]);
        }
        lighting*=color;
        lighting+=ambient;
        if(gamma){
                lighting=pow(lighting,vec3(1.0/2.2));
        }
        FragColor=vec4(lighting,1.0);
}
```
可以看到未开启gamma校正时，暗部太暗而没有细节。
**未开启gamma校正：**
![BQACAgUAAyEGAASHRsPbAAEWLlBqP5LPZQKjjD_MEYSkvtkU7kMI1gACBigAAk05AVZZGugoTNZ1fjwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWLlBqP5LPZQKjjD_MEYSkvtkU7kMI1gACBigAAk05AVZZGugoTNZ1fjwE.png)
**开启gamma校正：**
![BQACAgUAAyEGAASHRsPbAAEWLlRqP5Lzg47UXuSc3B3fIWvAarpnuQACCigAAk05AVbLnrZLummo8jwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWLlRqP5Lzg47UXuSc3B3fIWvAarpnuQACCigAAk05AVbLnrZLummo8jwE.png)

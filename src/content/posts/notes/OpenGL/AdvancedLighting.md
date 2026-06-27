---
title: Advanced Lighting
published: 2026-06-27
description: 'Learn OpenGL 第五章第一节'
image: ''
tags: [OpenGL]
category: '学习笔记/OpenGL'
draft: false 
lang: 'zh'
---
# Phong 光照模型高光缺陷
对于 Phong 光照模型，高光计算依据视线方向与光线反射方向的夹角。当两个向量夹角超过 90 度时，点积结果为负，高光值直接置为 0。
这种判定方式存在缺陷：当 `shininess`（镜面反光度）数值很小时，高光覆盖范围很大，反向光线依然会对表面亮度产生明显影响，但 Phong 模型会直接舍弃这部分高光贡献，计算结果不符合真实光照表现。
# Blinn-Phong 光照模型核心改进原理
为解决 Phong 模型的缺陷，引入 Blinn-Phong 光照模型。
Blinn-Phong 模型的高光不再基于视线与反射光的夹角，而是计算半角向量（光线与视线的中间向量）与模型表面法线的夹角。
该机制下，视线任意偏移，半角向量与法线的夹角默认不会超过 90 度，只有当光源或视线位于模型表面下方时，夹角才会失效，彻底规避了 Phong 模型的高光误剔除问题。
# Blinn-Phong 解决 Phong 高光断层问题
Blinn-Phong 模型最核心的作用：修复 Phong 光照的高光断层、边缘突兀消失问题。
# Phong 与 Blinn-Phong 高光效果细微差异
半角向量与表面法线的夹角，通常小于 Phong 模型中视线与反射向量的夹角。对应点积结果更接近 1。
由于高光指数运算以点积结果为底数，底数越接近 1，高光衰减速度越慢，最终表现为：相同反光度下，Blinn-Phong 的高光范围更大、更柔和。
# 两种模型的参数适配规则
若想要 Blinn-Phong 达到和 Phong（风氏着色）一致的高光锐度效果，需要提高 Blinn-Phong 的 `shininess` 镜面反光度，缩小高光范围、提升锐度。
常规适配标准：Blinn-Phong 的反光度数值，设置为 Phong 着色反光度的 `2~4` 倍。

”高级“实则就是把**phong模型**改成了**blinn-phong模型**以**解决视线和反射向量夹角大于90度导致高光突然消失，使得高光边缘过渡剧烈，边缘锐利的不真实效果**。代码的核心在于**片元着色器**，**phong是计算视线方向和反射方向夹角，blinn-hong是计算法线方向和半角向量夹角。**
但我想说的是演示的巧妙逻辑：**按B键切换两种光照模型的实现**。首先在`main.cpp`中定义了一个`bool`类型的变量标记当前使用的是哪一种光照模型，然后在处理键盘输入的函数中监听是否按下B键并把这个状态传递到片元着色器。在监听中使用了`blinn`和`blinnKeyPressed`两个`bool`变量，`blinn`是传给着色器的状态变量，`blinnKeyPressed`则是防止长按按键时每帧都更新blinn导致来回切换。（因为代码逻辑是按下B键，切换当前光照模型，再按下，切换另一种，所以按下时是`blinn=!blinn`，如果长按B，每帧都是按下状态，每帧都执行`blinn=!blinn`）
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
bool blinn = false;
bool blinnKeyPressed = false;

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
        if (glfwGetKey(window, GLFW_KEY_B) == GLFW_PRESS && !blinnKeyPressed) {
                //并非长按B，且B被按下了
                //切换状态
                blinn = !blinn;
                blinnKeyPressed = true;
        }
        if (glfwGetKey(window, GLFW_KEY_B) != GLFW_PRESS) {
                //B没有被按下，更新按键状态
                blinnKeyPressed = false;
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

        unsigned int floorTexture = loadTexture("resources/textures/wood.jpg");

        Shader shader("src/Shader/vertexShader.txt", "src/Shader/fragmentShader.txt");

        shader.use();
        shader.setInt("floorTexture", 0);

        glm::vec3 lightPos(0.0f, 0.0f, 0.0f);

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
                shader.setVec3("lightPos", lightPos);
                shader.setInt("blinn", blinn);

                glBindVertexArray(quadVAO);
                glActiveTexture(GL_TEXTURE0);
                glBindTexture(GL_TEXTURE_2D, floorTexture);
                glDrawArrays(GL_TRIANGLES, 0, 6);
                glBindVertexArray(0);
                
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

//顶点已经是世界空间无需model变换
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
uniform vec3 lightPos;
uniform vec3 viewPos;
uniform bool blinn;
void main(){
        vec3 color=texture(floorTexture,fs_in.TexCoords).rgb;
        vec3 ambient=0.05*color;
        vec3 worldLightDir=normalize(lightPos-fs_in.FragPos);
        vec3 worldNormal=normalize(fs_in.Normal);
        float diff=max(dot(worldLightDir,worldNormal),0.0);
        vec3 diffuse=diff*color;

        vec3 worldViewDir=normalize(viewPos-fs_in.FragPos);
        vec3 reflectDir=reflect(-worldLightDir,worldNormal);
        float spec=0.0;
        if(blinn){
                vec3 halfDir=normalize(worldViewDir+worldLightDir);
                spec=pow(max(dot(worldNormal,halfDir),0.0),32.0);
        }else{
                spec=pow(max(dot(worldViewDir,reflectDir),0.0),8.0);
        }
        vec3 specular=vec3(0.3)*spec;
        FragColor=vec4(ambient+diffuse+specular,1.0);
}
```
**blinn-phong:**
![BQACAgUAAyEGAASHRsPbAAEWLiRqP5EomF8NFAPqW9J_iUrM3TA0awAC1ycAAk05AVZjjPX1AyLyEDwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWLiRqP5EomF8NFAPqW9J_iUrM3TA0awAC1ycAAk05AVZjjPX1AyLyEDwE.png)
**phong:**
![BQACAgUAAyEGAASHRsPbAAEWLiZqP5FBgduwn-cUl7IptWVxocYNuAAC2ScAAk05AVZ8iQzm8NFw6TwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWLiZqP5FBgduwn-cUl7IptWVxocYNuAAC2ScAAk05AVZ8iQzm8NFw6TwE.png)
---
title: Cubemap Map
published: 2026-06-27
description: 'Learn OpenGL 第四章第六节'
image: ''
tags: [OpenGL]
category: '学习笔记/OpenGL'
draft: false 
lang: 'zh'
---
# 立方体贴图采样原理
立方体贴图不依赖常规二维 UV 纹理坐标，依靠**三维方向向量**完成采样。
当天空盒立方体中心处于坐标原点时，立方体每个顶点的坐标，本身就是一条**从原点指向立方体表面的方向射线**。因此在采样立方体贴图时，可直接使用**顶点位置坐标替代纹理坐标**，无需额外定义UV坐标。
# 立方体贴图存储特性
- 立方体贴图由**6张不同方向的二维纹理**（立方体六个面）组合打包而成。
- 整套立方体贴图只对应**一个纹理对象、一个纹理ID**，统一管理。
- 采样过程由 OpenGL 硬件自动完成：根据传入的三维方向向量，自动判断该射线命中立方体的哪一个面，并对应采集该面的纹理像素颜色。
# 天空盒渲染与深度修正
## 先绘天空盒的缺陷
常规思路：先渲染天空盒立方体，同时**关闭深度写入**，让天空盒不占用深度缓冲，后续场景物体可正常写入深度、覆盖天空盒画面。
该方案存在性能问题：天空盒最先渲染，所有像素的深度测试全部通过，全屏像素都会执行渲染计算，但天空盒绝大部分区域最终会被场景物体覆盖，产生大量**无效渲染开销**。
## 先绘场景物体的缺陷
优化思路：先渲染所有场景物体，**最后渲染天空盒**，规避无效渲染。
但天空盒始终贴近相机，深度值极小，正常深度测试几乎全部通过**，会覆盖已经渲染完成的场景物体**，画面错乱。
## 最终解决方案：篡改裁剪空间深度
核心思路：**强制让天空盒的深度值为屏幕深度最大值（1.0）**，让其永远被场景物体遮挡。
深度值推导逻辑：
1. 深度缓冲最终存储的是 NDC 空间归一化后的深度值，范围 `[0,1]`；
2. 想要深度值 = `1.0`，需要满足 `NDC.z = 1`；
3. NDC 坐标由裁剪空间坐标透视除法得到，`NDC.z = clip.z / clip.w`；
4. 因此令 `clip.z = clip.w`，即可保证 `NDC.z = 1`。
具体实现：在天空盒顶点着色器中，手动篡改输出的裁剪空间坐标：`gl_Position.z = gl_Position.w`，让天空盒所有片元深度值为最大值。
# 深度测试函数适配修改
OpenGL 默认深度测试函数为 `GL_LESS`（深度更小则通过）。天空盒深度值恒为 `1.0`，若使用默认函数会永远无法通过测试，导致天空盒不显示。
因此需要将深度测试函数改为 `GL_LEQUAL`（深度小于等于当前值则通过），保证空白区域的天空盒可以正常渲染。
# 其他注意事项
1. 渲染天空盒时，需要**抹除视图矩阵的平移分量**，仅保留旋转分量。
*效果*：无论相机如何平移移动，天空盒在相机空间中的相对位置和尺寸始终保持不变，不会随相机远近发生缩放、位移，只会跟随相机旋转改变视角，完美模拟无限远的天空效果。
2. 与普通2D纹理不同，**立方体贴图不需要垂直翻转UV**，可直接使用原始贴图资源采样，无需处理Y轴翻转适配。

# example1: 天空盒
给一个立方体应用上立方体纹理，那么这个立方体就可以作为包裹整个场景的天空盒。而要给模型应用纹理，需要定义模型的纹理坐标。但对于立方体纹理而言，它接收一个三维方向向量作为采样向量。如果这个立方体原点位于中心，那么顶点的位置坐标就等价于原点到顶点的方向向量，就可以用来采样立方体纹理。
**首先是天空盒的加载**，与正常的纹理加载相同，只是一张天空盒纹理包含六小张纹理，所以需要加载六次、传递六次数据。并且纹理目标也有所不同，每一小张对应一个纹理目标。
**然后是天空盒纹理的使用**。将天空盒纹理渲染到一个立方体上，并且这个渲染在整个渲染流程中最先，关闭深度写入，保证后续绘制的物体一定能遮挡住立方体。为避免相机移动时，天空盒立方体也移动，则不让视图矩阵的平移分量作用于立方体。
![BQACAgUAAyEGAASHRsPbAAEWLFNqP3wTSm8YZoD2aJlLeolHOYBxdQACziUAAk05AVYz2hOqQhjAWzwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWLFNqP3wTSm8YZoD2aJlLeolHOYBxdQACziUAAk05AVYz2hOqQhjAWzwE.png)
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

        float cubeVertices[] = {
                // positions          // texture Coords
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

        vector<string> faces{
                "resources/textures/skybox/right.jpg",
                "resources/textures/skybox/left.jpg",
                "resources/textures/skybox/top.jpg",
                "resources/textures/skybox/bottom.jpg",
                "resources/textures/skybox/back.jpg",
                "resources/textures/skybox/front.jpg",
        };

        //天空盒立方体的定义，中心在世界坐标原点，顶点是世界空间下，那么顶点位置坐标等价于原点到顶点向量，即世界空间下的一个方向向量
        float skyboxVertices[] = {
                -0.5f,  0.5f, -0.5f,
                -0.5f, -0.5f, -0.5f,
                 0.5f, -0.5f, -0.5f,
                 0.5f, -0.5f, -0.5f,
                 0.5f,  0.5f, -0.5f,
                -0.5f,  0.5f, -0.5f,

                -0.5f, -0.5f,  0.5f,
                -0.5f, -0.5f, -0.5f,
                -0.5f,  0.5f, -0.5f,
                -0.5f,  0.5f, -0.5f,
                -0.5f,  0.5f,  0.5f,
                -0.5f, -0.5f,  0.5f,

                 0.5f, -0.5f, -0.5f,
                 0.5f, -0.5f,  0.5f,
                 0.5f,  0.5f,  0.5f,
                 0.5f,  0.5f,  0.5f,
                 0.5f,  0.5f, -0.5f,
                 0.5f, -0.5f, -0.5f,

                -0.5f, -0.5f,  0.5f,
                -0.5f,  0.5f,  0.5f,
                 0.5f,  0.5f,  0.5f,
                 0.5f,  0.5f,  0.5f,
                 0.5f, -0.5f,  0.5f,
                -0.5f, -0.5f,  0.5f,

                -0.5f,  0.5f, -0.5f,
                 0.5f,  0.5f, -0.5f,
                 0.5f,  0.5f,  0.5f,
                 0.5f,  0.5f,  0.5f,
                -0.5f,  0.5f,  0.5f,
                -0.5f,  0.5f, -0.5f,

                -0.5f, -0.5f, -0.5f,
                -0.5f, -0.5f,  0.5f,
                 0.5f, -0.5f, -0.5f,
                 0.5f, -0.5f, -0.5f,
                -0.5f, -0.5f,  0.5f,
                 0.5f, -0.5f,  0.5f
        };

        unsigned int cubeVAO, cubeVBO;
        glGenVertexArrays(1, &cubeVAO);
        glGenBuffers(1, &cubeVBO);
        glBindVertexArray(cubeVAO);
        glBindBuffer(GL_ARRAY_BUFFER,cubeVBO);
        glBufferData(GL_ARRAY_BUFFER, sizeof(cubeVertices), cubeVertices, GL_STATIC_DRAW);
        glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 5 * sizeof(float), (void*)0);
        glEnableVertexAttribArray(0);
        glVertexAttribPointer(1, 2, GL_FLOAT, GL_FALSE, 5 * sizeof(float), (void*)(3*sizeof(float)));
        glEnableVertexAttribArray(1);
        glBindVertexArray(0);

        unsigned int planeVAO, planeVBO;
        glGenVertexArrays(1, &planeVAO);
        glGenBuffers(1, &planeVBO);
        glBindVertexArray(planeVAO);
        glBindBuffer(GL_ARRAY_BUFFER, planeVBO);
        glBufferData(GL_ARRAY_BUFFER, sizeof(planeVertices), planeVertices, GL_STATIC_DRAW);
        glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 5 * sizeof(float), (void*)0);
        glEnableVertexAttribArray(0);
        glVertexAttribPointer(1, 2, GL_FLOAT, GL_FALSE, 5 * sizeof(float), (void*)(3 * sizeof(float)));
        glEnableVertexAttribArray(1);
        glBindVertexArray(0);

        unsigned int skyboxVAO, skyboxVBO;
        glGenVertexArrays(1, &skyboxVAO);
        glGenBuffers(1, &skyboxVBO);
        glBindVertexArray(skyboxVAO);
        glBindBuffer(GL_ARRAY_BUFFER, skyboxVBO);
        glBufferData(GL_ARRAY_BUFFER, sizeof(skyboxVertices), skyboxVertices, GL_STATIC_DRAW);
        glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 3 * sizeof(float), (void*)0);
        glEnableVertexAttribArray(0);
        glBindVertexArray(0);

        Shader shader("src/Shader/vertexShader.txt", "src/Shader/fragmentShader.txt");
        Shader skyboxShader("src/Shader/skyboxVertexShader.txt", "src/Shader/skyboxFragmentShader.txt");

        unsigned int texture1 = loadTexture("resources/textures/container.jpg");
        unsigned int texture2 = loadTexture("resources/textures/metal.jpg");
        unsigned int texture3 = loadCubemap(faces);

        shader.use();
        shader.setInt("texture1", 0);
        shader.setInt("texture2", 1);

        skyboxShader.use();
        skyboxShader.setInt("skybox", 0);

        while (!glfwWindowShouldClose(window)) {
                float currentFrame = (float)glfwGetTime();
                deltaTime = currentFrame - lastFrame;
                lastFrame = currentFrame;

                processInput(window);

                glClearColor(0.1, 0.1, 0.1, 1.0);
                glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

                skyboxShader.use();
                glDepthMask(GL_FALSE);
                glm::mat4 model = glm::mat4(1.0f);
                glm::mat4 view;
                view = glm::mat4(glm::mat3(camera.GetCameraView()));
                skyboxShader.setMatrix("view", view);
                glm::mat4 project = glm::perspective(glm::radians(camera.Zoom), (float)SCR_WIDTH / (float)SCR_HEIGHT, 0.1f, 100.0f);
                skyboxShader.setMatrix("project", project);
                glBindVertexArray(skyboxVAO);
                glActiveTexture(GL_TEXTURE0);
                glBindTexture(GL_TEXTURE_CUBE_MAP, texture3);
                glDrawArrays(GL_TRIANGLES, 0, 36);
                glBindVertexArray(0);
                glDepthMask(GL_TRUE);

                shader.use();
                glBindVertexArray(cubeVAO);
                glActiveTexture(GL_TEXTURE0);
                glBindTexture(GL_TEXTURE_2D, texture1);
                shader.setInt("useTex", 1);
                model = glm::translate(model, glm::vec3(-1.0f, 0.0f, -1.0f));
                shader.setMatrix("model", model);
                view = camera.GetCameraView();
                shader.setMatrix("view", view);
                shader.setMatrix("project", project);
                glDrawArrays(GL_TRIANGLES, 0, 36);

                model = glm::mat4(1.0f);
                model = glm::translate(model, glm::vec3(2.0f, 0.0f, 0.0f));
                shader.setMatrix("model", model);
                glDrawArrays(GL_TRIANGLES, 0, 36);
                glBindVertexArray(0);

                glBindVertexArray(planeVAO);
                glActiveTexture(GL_TEXTURE1);
                glBindTexture(GL_TEXTURE_2D, texture2);
                shader.setInt("useTex", 2);
                model = glm::mat4(1.0);
                shader.setMatrix("model", model);
                glDrawArrays(GL_TRIANGLES, 0, 6);
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
//skyboxVertexShader
#version 330 core
layout (location = 0) in vec3 aPos;

out vec3 TexCoords;

uniform mat4 view;
uniform mat4 project;

void main(){
        TexCoords=aPos;
        gl_Position=project*view*vec4(aPos,1.0);
}
```
```glsl
//skyboxFragmentShader
#version 330 core
in vec3 TexCoords;//使用方向向量采样，是vec3而非vec2

out vec4 FragColor;

uniform samplerCube skybox;

void main(){
        FragColor=texture(skybox,TexCoords);
}
```

# example2: 环境映射
**立方体贴图**不仅可以用于**天空盒**，还可以用于**环境映射，包括反射和折射**。
对于**反射**而言，主要是修改渲染立方体物体的顶点着色器和片元着色器。在片元着色器中，传入立方体贴图，计算反射向量（根据视线方向和法线方向），使用反射向量采样立方体贴图作为输出颜色。
![BQACAgUAAyEGAASHRsPbAAEWLFRqP3yNrkpmzcgPgtdkSWyPSdi_ogAC0SUAAk05AVbytVUZBLInQDwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWLFRqP3yNrkpmzcgPgtdkSWyPSdi_ogAC0SUAAk05AVbytVUZBLInQDwE.png)
```glsl
//vertexShader
#version 330 core
layout (location = 0) in vec3 aPos;
layout (location = 1) in vec3 aNormal;

out vec3 Normal;
out vec3 FragPos;

uniform mat4 model;
uniform mat4 view;
uniform mat4 project;

void main(){
        gl_Position=project*view*model*vec4(aPos,1.0);
        FragPos=mat3(model)*aPos;
        Normal=mat3(transpose(inverse(model)))*aNormal;
}
```
```glsl
//fragmentShader
#version 330 core
in vec3 Normal;
in vec3 FragPos;

out vec4 FragColor;

uniform samplerCube skybox;
uniform vec3 viewPos;

void main(){
        vec3 worldViewDir=normalize(FragPos-viewPos);
        vec3 worldNormal=normalize(Normal);
        vec3 reflectDir=reflect(worldViewDir,worldNormal);
        FragColor=vec4(texture(skybox,reflectDir).rgb,1.0);
}
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
        glDepthFunc(GL_LEQUAL);

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

        vector<string> faces{
                "resources/textures/skybox/right.jpg",
                "resources/textures/skybox/left.jpg",
                "resources/textures/skybox/top.jpg",
                "resources/textures/skybox/bottom.jpg",
                "resources/textures/skybox/back.jpg",
                "resources/textures/skybox/front.jpg",
        };

        //天空盒立方体的定义，中心在世界坐标原点，顶点是世界空间下，那么顶点位置坐标等价于原点到顶点向量，即世界空间下的一个方向向量
        float skyboxVertices[] = {
                -0.5f,  0.5f, -0.5f,
                -0.5f, -0.5f, -0.5f,
                 0.5f, -0.5f, -0.5f,
                 0.5f, -0.5f, -0.5f,
                 0.5f,  0.5f, -0.5f,
                -0.5f,  0.5f, -0.5f,

                -0.5f, -0.5f,  0.5f,
                -0.5f, -0.5f, -0.5f,
                -0.5f,  0.5f, -0.5f,
                -0.5f,  0.5f, -0.5f,
                -0.5f,  0.5f,  0.5f,
                -0.5f, -0.5f,  0.5f,

                 0.5f, -0.5f, -0.5f,
                 0.5f, -0.5f,  0.5f,
                 0.5f,  0.5f,  0.5f,
                 0.5f,  0.5f,  0.5f,
                 0.5f,  0.5f, -0.5f,
                 0.5f, -0.5f, -0.5f,

                -0.5f, -0.5f,  0.5f,
                -0.5f,  0.5f,  0.5f,
                 0.5f,  0.5f,  0.5f,
                 0.5f,  0.5f,  0.5f,
                 0.5f, -0.5f,  0.5f,
                -0.5f, -0.5f,  0.5f,

                -0.5f,  0.5f, -0.5f,
                 0.5f,  0.5f, -0.5f,
                 0.5f,  0.5f,  0.5f,
                 0.5f,  0.5f,  0.5f,
                -0.5f,  0.5f,  0.5f,
                -0.5f,  0.5f, -0.5f,

                -0.5f, -0.5f, -0.5f,
                -0.5f, -0.5f,  0.5f,
                 0.5f, -0.5f, -0.5f,
                 0.5f, -0.5f, -0.5f,
                -0.5f, -0.5f,  0.5f,
                 0.5f, -0.5f,  0.5f
        };

        unsigned int cubeVAO, cubeVBO;
        glGenVertexArrays(1, &cubeVAO);
        glGenBuffers(1, &cubeVBO);
        glBindVertexArray(cubeVAO);
        glBindBuffer(GL_ARRAY_BUFFER,cubeVBO);
        glBufferData(GL_ARRAY_BUFFER, sizeof(vertices), vertices, GL_STATIC_DRAW);
        glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 6 * sizeof(float), (void*)0);
        glEnableVertexAttribArray(0);
        glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, 6 * sizeof(float), (void*)(3*sizeof(float)));
        glEnableVertexAttribArray(1);
        glBindVertexArray(0);

        unsigned int skyboxVAO, skyboxVBO;
        glGenVertexArrays(1, &skyboxVAO);
        glGenBuffers(1, &skyboxVBO);
        glBindVertexArray(skyboxVAO);
        glBindBuffer(GL_ARRAY_BUFFER, skyboxVBO);
        glBufferData(GL_ARRAY_BUFFER, sizeof(skyboxVertices), skyboxVertices, GL_STATIC_DRAW);
        glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 3 * sizeof(float), (void*)0);
        glEnableVertexAttribArray(0);
        glBindVertexArray(0);

        Shader shader("src/Shader/vertexShader.txt", "src/Shader/fragmentShader.txt");
        Shader skyboxShader("src/Shader/skyboxVertexShader.txt", "src/Shader/skyboxFragmentShader.txt");

        unsigned int texture3 = loadCubemap(faces);

        shader.use();
        shader.setInt("skybox", 0);

        skyboxShader.use();
        skyboxShader.setInt("skybox", 0);

        while (!glfwWindowShouldClose(window)) {
                float currentFrame = (float)glfwGetTime();
                deltaTime = currentFrame - lastFrame;
                lastFrame = currentFrame;

                processInput(window);

                glClearColor(0.1, 0.1, 0.1, 1.0);
                glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

                skyboxShader.use();
                glDepthMask(GL_FALSE);
                glm::mat4 model = glm::mat4(1.0f);
                glm::mat4 view;
                view = glm::mat4(glm::mat3(camera.GetCameraView()));
                skyboxShader.setMatrix("view", view);
                glm::mat4 project = glm::perspective(glm::radians(camera.Zoom), (float)SCR_WIDTH / (float)SCR_HEIGHT, 0.1f, 100.0f);
                skyboxShader.setMatrix("project", project);
                glBindVertexArray(skyboxVAO);
                glActiveTexture(GL_TEXTURE0);
                glBindTexture(GL_TEXTURE_CUBE_MAP, texture3);
                glDrawArrays(GL_TRIANGLES, 0, 36);
                glBindVertexArray(0);
                glDepthMask(GL_TRUE);

                shader.use();
                shader.setVec3("viewPos", camera.Position);
                glBindVertexArray(cubeVAO);
                glActiveTexture(GL_TEXTURE0);
                glBindTexture(GL_TEXTURE_CUBE_MAP, texture3);
                model = glm::translate(model, glm::vec3(-1.0f, 0.0f, -1.0f));
                shader.setMatrix("model", model);
                view = camera.GetCameraView();
                shader.setMatrix("view", view);
                shader.setMatrix("project", project);
                glDrawArrays(GL_TRIANGLES, 0, 36);

                model = glm::mat4(1.0f);
                model = glm::translate(model, glm::vec3(2.0f, 0.0f, 0.0f));
                shader.setMatrix("model", model);
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
在之前的**背包模型**上实现**反射**效果：
![BQACAgUAAyEGAASHRsPbAAEWLFdqP3zHpYo9Uwd9Q3LB755UfT3yPQAC1SUAAk05AVYT89AEPm79wzwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWLFdqP3zHpYo9Uwd9Q3LB755UfT3yPQAC1SUAAk05AVYT89AEPm79wzwE.png)
当**反射**应用到**一整个物体**上（像是箱子）时，这个物体看起来就像是钢或者铬这样的高反射性材质。
对于**折射**而言，主要在于计算折射方向的不同。使用`refract`函数，传入视线方向、法线方向以及两个介质的折射率。
把**反射**和**折射**一起应用到物体上，通过视角相关的`fresnel`控制**混合比例**。
![BQACAgUAAyEGAASHRsPbAAEWLF1qP30a17lchcvthUjDdbeCDutKvQAC3CUAAk05AVb1xTUnPPabqjwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWLF1qP30a17lchcvthUjDdbeCDutKvQAC3CUAAk05AVb1xTUnPPabqjwE.png)
```glsl
//fragmentShader
#version 330 core
in vec3 Normal;
in vec3 FragPos;
in vec2 TexCoords;

out vec4 FragColor;

struct Material{
        sampler2D texture_diffuse1;
        sampler2D texture_specular1;
        sampler2D texture_normal1;
        sampler2D texture_height1;
        sampler2D texture_reflection1;
};
uniform Material material;
uniform samplerCube skybox;
uniform vec3 viewPos;

void main(){
        vec3 worldViewDir=normalize(FragPos-viewPos);
        vec3 worldNormal=normalize(Normal);
        vec3 refractDir=refract(worldViewDir,worldNormal,1.00/1.52);
        vec3 reflectDir=reflect(worldViewDir,worldNormal);
        vec3 refractColor=texture(skybox,refractDir).rgb;
        vec3 reflectColor=texture(skybox,reflectDir).rgb;
        float fresnel=pow(1.0-max(dot(worldViewDir,worldNormal),0.0),2.0);
        vec3 finalColor=mix(refractColor,reflectColor,fresnel);
        FragColor=vec4(finalColor,1.0);
}
```

# example3: 动态环境贴图
定义立方体环境贴图`FBO`并绑定，从六个视角渲染场景（不包含要应用动态环境贴图的模型，避免自反射），渲染结果存入`FBO`的六个颜色附件（采用纹理形式）。切换回屏幕帧缓冲，正常渲染场景（包含要应用动态环境贴图的模型），且对于要应用动态环境贴图的模型来说，从`FBO`的颜色纹理（即六张颜色附件纹理构成的立方体纹理）中采样。
此外，立方体贴图每个面都是正方形，而整个窗口不是正方形，所以在把当前场景渲染到立方体贴图的六个面时，必须使用`glViewport`改变窗口大小，渲染完之后再次使用`glViewport`改回来。 
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
        glDepthFunc(GL_LEQUAL);

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

        vector<string> faces{
                "resources/textures/skybox/right.jpg",
                "resources/textures/skybox/left.jpg",
                "resources/textures/skybox/top.jpg",
                "resources/textures/skybox/bottom.jpg",
                "resources/textures/skybox/back.jpg",
                "resources/textures/skybox/front.jpg",
        };

        //天空盒立方体的定义，中心在世界坐标原点，顶点是世界空间下，那么顶点位置坐标等价于原点到顶点向量，即世界空间下的一个方向向量
        float skyboxVertices[] = {
                -0.5f,  0.5f, -0.5f,
                -0.5f, -0.5f, -0.5f,
                 0.5f, -0.5f, -0.5f,
                 0.5f, -0.5f, -0.5f,
                 0.5f,  0.5f, -0.5f,
                -0.5f,  0.5f, -0.5f,

                -0.5f, -0.5f,  0.5f,
                -0.5f, -0.5f, -0.5f,
                -0.5f,  0.5f, -0.5f,
                -0.5f,  0.5f, -0.5f,
                -0.5f,  0.5f,  0.5f,
                -0.5f, -0.5f,  0.5f,

                 0.5f, -0.5f, -0.5f,
                 0.5f, -0.5f,  0.5f,
                 0.5f,  0.5f,  0.5f,
                 0.5f,  0.5f,  0.5f,
                 0.5f,  0.5f, -0.5f,
                 0.5f, -0.5f, -0.5f,

                -0.5f, -0.5f,  0.5f,
                -0.5f,  0.5f,  0.5f,
                 0.5f,  0.5f,  0.5f,
                 0.5f,  0.5f,  0.5f,
                 0.5f, -0.5f,  0.5f,
                -0.5f, -0.5f,  0.5f,

                -0.5f,  0.5f, -0.5f,
                 0.5f,  0.5f, -0.5f,
                 0.5f,  0.5f,  0.5f,
                 0.5f,  0.5f,  0.5f,
                -0.5f,  0.5f,  0.5f,
                -0.5f,  0.5f, -0.5f,

                -0.5f, -0.5f, -0.5f,
                -0.5f, -0.5f,  0.5f,
                 0.5f, -0.5f, -0.5f,
                 0.5f, -0.5f, -0.5f,
                -0.5f, -0.5f,  0.5f,
                 0.5f, -0.5f,  0.5f
        };

        vector<glm::mat4> cubeViews = {
                glm::lookAt(glm::vec3(0.0f), glm::vec3(1.0f, 0.0f, 0.0f), glm::vec3(0.0f,-1.0f, 0.0f)), // +X
                glm::lookAt(glm::vec3(0.0f), glm::vec3(-1.0f, 0.0f, 0.0f), glm::vec3(0.0f,-1.0f, 0.0f)), // -X
                glm::lookAt(glm::vec3(0.0f), glm::vec3(0.0f, 1.0f, 0.0f), glm::vec3(0.0f, 0.0f,-1.0f)), // +Y
                glm::lookAt(glm::vec3(0.0f), glm::vec3(0.0f,-1.0f, 0.0f), glm::vec3(0.0f, 0.0f, 1.0f)), // -Y
                glm::lookAt(glm::vec3(0.0f), glm::vec3(0.0f, 0.0f, 1.0f), glm::vec3(0.0f,-1.0f, 0.0f)), // +Z
                glm::lookAt(glm::vec3(0.0f), glm::vec3(0.0f, 0.0f,-1.0f), glm::vec3(0.0f,-1.0f, 0.0f))  // -Z
        };

        unsigned int cubeVAO, cubeVBO;
        glGenVertexArrays(1, &cubeVAO);
        glGenBuffers(1, &cubeVBO);
        glBindVertexArray(cubeVAO);
        glBindBuffer(GL_ARRAY_BUFFER,cubeVBO);
        glBufferData(GL_ARRAY_BUFFER, sizeof(vertices), vertices, GL_STATIC_DRAW);
        glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 6 * sizeof(float), (void*)0);
        glEnableVertexAttribArray(0);
        glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, 6 * sizeof(float), (void*)(3*sizeof(float)));
        glEnableVertexAttribArray(1);
        glBindVertexArray(0);

        unsigned int skyboxVAO, skyboxVBO;
        glGenVertexArrays(1, &skyboxVAO);
        glGenBuffers(1, &skyboxVBO);
        glBindVertexArray(skyboxVAO);
        glBindBuffer(GL_ARRAY_BUFFER, skyboxVBO);
        glBufferData(GL_ARRAY_BUFFER, sizeof(skyboxVertices), skyboxVertices, GL_STATIC_DRAW);
        glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 3 * sizeof(float), (void*)0);
        glEnableVertexAttribArray(0);
        glBindVertexArray(0);

        unsigned int envFBO;
        glGenFramebuffers(1, &envFBO);
        glBindFramebuffer(GL_FRAMEBUFFER, envFBO);

        unsigned int envTex;
        glGenTextures(1, &envTex);
        glBindTexture(GL_TEXTURE_CUBE_MAP, envTex);
        for (int i = 0; i < 6; i++) {
                glTexImage2D(GL_TEXTURE_CUBE_MAP_POSITIVE_X + i, 0, GL_RGB, 512, 512, 0, GL_RGB, GL_UNSIGNED_BYTE, NULL);
        }
        glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_WRAP_R, GL_CLAMP_TO_EDGE);
        glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
        glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
        glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
        glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_MAG_FILTER, GL_LINEAR);

        unsigned int envRBO;
        glGenRenderbuffers(1, &envRBO);
        glBindRenderbuffer(GL_RENDERBUFFER, envRBO);
        glRenderbufferStorage(GL_RENDERBUFFER, GL_DEPTH24_STENCIL8, 512, 512);
        glFramebufferRenderbuffer(GL_FRAMEBUFFER, GL_DEPTH_STENCIL_ATTACHMENT, GL_RENDERBUFFER, envRBO);

        if (glCheckFramebufferStatus(GL_FRAMEBUFFER) != GL_FRAMEBUFFER_COMPLETE) {
                cout << "ERROR::ENV FBO INCOMPLETE!" << endl;
        }
        glBindFramebuffer(GL_FRAMEBUFFER, 0);
        glBindTexture(GL_TEXTURE_CUBE_MAP, 0);
        glBindRenderbuffer(GL_RENDERBUFFER, 0);

        Shader shader("src/Shader/vertexShader.txt", "src/Shader/fragmentShader.txt");
        Shader skyboxShader("src/Shader/skyboxVertexShader.txt", "src/Shader/skyboxFragmentShader.txt");

        Model myModel("resources/objects/backpack/backpack.obj");

        unsigned int texture3 = loadCubemap(faces);

        shader.use();
        shader.setInt("skybox", 4);

        skyboxShader.use();
        skyboxShader.setInt("skybox", 0);

        while (!glfwWindowShouldClose(window)) {
                float currentFrame = (float)glfwGetTime();
                deltaTime = currentFrame - lastFrame;
                lastFrame = currentFrame;

                processInput(window);

                glBindFramebuffer(GL_FRAMEBUFFER, envFBO);
                glViewport(0, 0, 512, 512);
                glm::vec3 reflectCenter = glm::vec3(0.0f);
                glm::mat4 envProj = glm::perspective(glm::radians(90.0f), 1.0f, 0.1f,100.0f);
                for (int i = 0; i < 6; i++) {
                        glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_CUBE_MAP_POSITIVE_X + i, envTex, 0);
                        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
                        shader.use();
                        shader.setMatrix("project", envProj);
                        glm::mat4 view = cubeViews[i];
                        shader.setMatrix("view", view);
                        shader.setVec3("viewPos", reflectCenter);

                        glDepthMask(GL_FALSE);
                        glm::mat4 skyView = glm::mat4(glm::mat3(view));
                        skyboxShader.use();
                        skyboxShader.setMatrix("view", skyView);
                        skyboxShader.setMatrix("project", envProj);
                        glBindVertexArray(skyboxVAO);
                        glActiveTexture(GL_TEXTURE0);
                        glBindTexture(GL_TEXTURE_CUBE_MAP, texture3);
                        glDrawArrays(GL_TRIANGLES, 0, 36);
                        glBindVertexArray(0);
                        glDepthMask(GL_TRUE);

                        //渲染其他物体，跳过要做反射的物体
                        shader.use();
                        glm::mat4 cubeModel = glm::mat4(1.0f);
                        cubeModel = glm::translate(cubeModel, glm::vec3(0.0f, 0.0f, 2.4f));
                        cubeModel = glm::scale(cubeModel, glm::vec3(1.0f));
                        shader.setMatrix("model", cubeModel);
                        shader.setInt("useReflection", 0);
                        glBindVertexArray(cubeVAO);
                        glDrawArrays(GL_TRIANGLES, 0, 36);
                        glBindVertexArray(0);
                }
                glBindFramebuffer(GL_FRAMEBUFFER, 0); 
                glViewport(0, 0, SCR_WIDTH, SCR_HEIGHT);

                glClearColor(0.1, 0.1, 0.1, 1.0);
                glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

                skyboxShader.use();
                glDepthMask(GL_FALSE);
                glm::mat4 model = glm::mat4(1.0f);
                glm::mat4 view;
                view = glm::mat4(glm::mat3(camera.GetCameraView()));
                skyboxShader.setMatrix("view", view);
                glm::mat4 project = glm::perspective(glm::radians(camera.Zoom), (float)SCR_WIDTH / (float)SCR_HEIGHT, 0.1f, 100.0f);
                skyboxShader.setMatrix("project", project);
                glBindVertexArray(skyboxVAO);
                glActiveTexture(GL_TEXTURE0);
                glBindTexture(GL_TEXTURE_CUBE_MAP, texture3);
                glDrawArrays(GL_TRIANGLES, 0, 36);
                glBindVertexArray(0);
                glDepthMask(GL_TRUE);

                shader.use();
                shader.setVec3("viewPos", camera.Position);
                glActiveTexture(GL_TEXTURE4);
                glBindTexture(GL_TEXTURE_CUBE_MAP, envTex);

                //绘制不带反射的立方体
                glm::mat4 cubeModel = glm::mat4(1.0f);
                cubeModel = glm::translate(cubeModel, glm::vec3(0.0f, 0.0f, 2.4f));
                cubeModel = glm::scale(cubeModel, glm::vec3(0.5f));
                shader.setMatrix("model", cubeModel);
                view = camera.GetCameraView();
                shader.setMatrix("view", view);
                shader.setMatrix("project", project);
                shader.setInt("useReflection", 0);
                glBindVertexArray(cubeVAO);
                glDrawArrays(GL_TRIANGLES, 0, 36);
                glBindVertexArray(0);

                //绘制带反射的模型
                model = glm::translate(model, glm::vec3(0.0f));
                model = glm::scale(model, glm::vec3(1.0f));
                shader.setMatrix("model", model);
                view = camera.GetCameraView();
                shader.setMatrix("view", view);
                shader.setMatrix("project", project);
                shader.setInt("useReflection", 1);
                myModel.Draw(shader);

                glfwSwapBuffers(window);
                glfwPollEvents();
        }
        glDeleteVertexArrays(1, &cubeVAO);
        glDeleteBuffers(1, &cubeVBO);
        glDeleteFramebuffers(1, &envFBO);
        glDeleteRenderbuffers(1, &envRBO);

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

out vec3 Normal;
out vec3 FragPos;
out vec2 TexCoords;

uniform mat4 model;
uniform mat4 view;
uniform mat4 project;

void main(){
        gl_Position=project*view*model*vec4(aPos,1.0);
        FragPos=mat3(model)*aPos;
        Normal=mat3(transpose(inverse(model)))*aNormal;
        TexCoords=aTexCoords;
}
```
```glsl
//fragmentShader
#version 330 core
in vec3 Normal;
in vec3 FragPos;
in vec2 TexCoords;

out vec4 FragColor;

struct Material{
        sampler2D texture_diffuse1;
        sampler2D texture_specular1;
        sampler2D texture_normal1;
        sampler2D texture_height1;
        sampler2D texture_reflection1;
};
uniform Material material;
uniform samplerCube skybox;
uniform vec3 viewPos;

uniform int useReflection;

void main(){
        if(useReflection == 0)
        {
                FragColor = vec4(texture(material.texture_diffuse1,TexCoords).rgb, 1.0);
                return;
        }
        vec3 worldViewDir=normalize(FragPos-viewPos);
        vec3 worldNormal=normalize(Normal);
        vec3 refractDir=refract(worldViewDir,worldNormal,1.00/1.52);
        vec3 reflectDir=reflect(worldViewDir,worldNormal);
        vec3 refractColor=texture(skybox,refractDir).rgb;
        vec3 reflectColor=texture(skybox,reflectDir).rgb;
        float fresnel=pow(1.0-max(dot(worldViewDir,worldNormal),0.0),2.0);
        vec3 finalColor=mix(refractColor,reflectColor,fresnel);
        FragColor=vec4(finalColor,1.0);
}
```

# homework
尝试在我们之前在模型加载小节中创建的模型加载器中引入反射贴图。你可以在这里找到升级后有反射贴图的背包模型。仍有几点要注意的：
  `Assimp`在大多数格式中都不太喜欢反射贴图，所以我们需要欺骗一下它，将反射贴图储存为漫反射贴图。你可以在加载材质的时候将反射贴图的纹理类型设置为`aiTextureType_AMBIENT`。
  我偷懒直接使用镜面光纹理图像来创建了反射贴图，所以反射贴图在模型的某些地方不能准确地映射`:)`。
  由于模型加载器本身就已经在着色器中占用了`3`个纹理单元了，你需要将天空盒绑定到第`4`个纹理单元上，因为我们要从同一个着色器中对天空盒采样。
*思路*：**首先修改`Model.h`**，增加反射贴图的处理逻辑：查找类型为`aiTextureType_AMBIENT`的贴图，作为反射贴图
```c
//Model.h
//处理材质
if (mesh->mMaterialIndex >= 0) {
        //materialIndex时网格的材质编号，据此索引到材质列表中的某个具体材质
        //materialIndex>=0表示该网格有材质，否则该网格没有材质，无需处理
        aiMaterial* material = scene->mMaterials[mesh->mMaterialIndex];
        vector<Texture> diffuseMaps = loadMaterialTextures(material, aiTextureType_DIFFUSE, "texture_diffuse");
        textures.insert(textures.end(), diffuseMaps.begin(), diffuseMaps.end());

        vector<Texture> specularMaps = loadMaterialTextures(material, aiTextureType_SPECULAR, "texture_specular");
        textures.insert(textures.end(), specularMaps.begin(), specularMaps.end());

        vector<Texture> normalMaps = loadMaterialTextures(material, aiTextureType_HEIGHT, "texture_normal");
        textures.insert(textures.end(), normalMaps.begin(), normalMaps.end());

        vector<Texture> heightMaps = loadMaterialTextures(material, aiTextureType_AMBIENT, "texture_height");
        textures.insert(textures.end(), heightMaps.begin(), heightMaps.end());

        vector<Texture> reflectionMaps = loadMaterialTextures(material, aiTextureType_AMBIENT, "texture_reflection");
        textures.insert(textures.end(), reflectionMaps.begin(), reflectionMaps.end());
}
```
**然后修改`Mesh.h`**，增加反射贴图的处理逻辑：数量、拼接`uniformName`
```c
//Mesh.h
void Draw(Shader& shader) {
        unsigned int diffuseNr = 1;//漫反射贴图的编号
        unsigned int specularNr = 1;//镜面反射贴图的编号
        unsigned int normalNr = 1;//法线贴图的编号
        unsigned int heightNr = 1;//高度图的编号
        unsigned int reflectionNr = 1;//反射贴图的编号

        //完成纹理数据的设置和绑定
        for (unsigned int i = 0; i < textures.size(); i++) {//遍历所有贴图，可能包含漫反射贴图，镜面反射贴图或是其他贴图，需要根据type判断
                //激活当前贴图对应的纹理单元
                glActiveTexture(GL_TEXTURE0 + i);

                string number;
                string name = textures[i].type;
                if (name == "texture_diffuse") {
                        number = to_string(diffuseNr++);
                }
                else if (name == "texture_specular") {
                        number = to_string(specularNr++);
                }
                else if (name == "texture_normal") {
                        number = to_string(normalNr++);
                }
                else if (name == "texture_height") {
                        number = to_string(heightNr++);
                }
                else if (name == "texture_reflection") {
                        number = to_string(reflectionNr++);
                }

                string uniformName = "material." + name + number;
                //获取Shader中这个uniform变量的位置
                int textureLoc = glGetUniformLocation(shader.ID, uniformName.c_str());
                //告诉Shader这个sampler2D指向第几个纹理单元
                glUniform1i(textureLoc, i);
                //当前纹理单元绑定第几号纹理
                glBindTexture(GL_TEXTURE_2D, textures[i].id);
        }
        //绘制网格
        glBindVertexArray(VAO);
        //告诉GPU从EBO缓冲中哪里开始取索引，取多少个，每个索引的数据类型是什么，取了之后怎么画
        glDrawElements(GL_TRIANGLES, static_cast<unsigned int>(indices.size()), GL_UNSIGNED_INT, 0);
        glBindVertexArray(0);//解绑，不一定必要（因为绘制物体前都会先绑定这个物体的VAO，但最好加上）

        glActiveTexture(GL_TEXTURE0);//跟上边解绑一样，使所有数据结构回到初始时的状态
}
```
**然后修改片元着色器**，增加反射贴图的定义，并在`main`函数中采样反射贴图、混合漫反射输出
```glsl
//fragmentShader
#version 330 core
in vec3 Normal;
in vec3 FragPos;
in vec2 TexCoords;

out vec4 FragColor;

struct Material{
        sampler2D texture_diffuse1;
        sampler2D texture_specular1;
        sampler2D texture_normal1;
        sampler2D texture_height1;
        sampler2D texture_reflection1;
};
uniform Material material;
uniform samplerCube skybox;
uniform vec3 viewPos;

void main(){
        vec3 worldViewDir=normalize(FragPos-viewPos);
        vec3 worldNormal=normalize(Normal);
        vec3 reflectDir=reflect(worldViewDir,worldNormal);
        vec3 reflectColor=texture(material.texture_reflection1,TexCoords).rgb;
        reflectColor*=texture(skybox,reflectDir).rgb;

        vec3 diffuseColor=texture(material.texture_diffuse1,TexCoords).rgb;

        vec3 finalColor=mix(diffuseColor,reflectColor,1.0);
        FragColor=vec4(finalColor,1.0);
}
```
**最后是`main.cpp`**，传递立方体纹理，以及在渲染循环中调用模型的绘制函数。
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
        glDepthFunc(GL_LEQUAL);

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

        vector<string> faces{
                "resources/textures/skybox/right.jpg",
                "resources/textures/skybox/left.jpg",
                "resources/textures/skybox/top.jpg",
                "resources/textures/skybox/bottom.jpg",
                "resources/textures/skybox/back.jpg",
                "resources/textures/skybox/front.jpg",
        };

        //天空盒立方体的定义，中心在世界坐标原点，顶点是世界空间下，那么顶点位置坐标等价于原点到顶点向量，即世界空间下的一个方向向量
        float skyboxVertices[] = {
                -0.5f,  0.5f, -0.5f,
                -0.5f, -0.5f, -0.5f,
                 0.5f, -0.5f, -0.5f,
                 0.5f, -0.5f, -0.5f,
                 0.5f,  0.5f, -0.5f,
                -0.5f,  0.5f, -0.5f,

                -0.5f, -0.5f,  0.5f,
                -0.5f, -0.5f, -0.5f,
                -0.5f,  0.5f, -0.5f,
                -0.5f,  0.5f, -0.5f,
                -0.5f,  0.5f,  0.5f,
                -0.5f, -0.5f,  0.5f,

                 0.5f, -0.5f, -0.5f,
                 0.5f, -0.5f,  0.5f,
                 0.5f,  0.5f,  0.5f,
                 0.5f,  0.5f,  0.5f,
                 0.5f,  0.5f, -0.5f,
                 0.5f, -0.5f, -0.5f,

                -0.5f, -0.5f,  0.5f,
                -0.5f,  0.5f,  0.5f,
                 0.5f,  0.5f,  0.5f,
                 0.5f,  0.5f,  0.5f,
                 0.5f, -0.5f,  0.5f,
                -0.5f, -0.5f,  0.5f,

                -0.5f,  0.5f, -0.5f,
                 0.5f,  0.5f, -0.5f,
                 0.5f,  0.5f,  0.5f,
                 0.5f,  0.5f,  0.5f,
                -0.5f,  0.5f,  0.5f,
                -0.5f,  0.5f, -0.5f,

                -0.5f, -0.5f, -0.5f,
                -0.5f, -0.5f,  0.5f,
                 0.5f, -0.5f, -0.5f,
                 0.5f, -0.5f, -0.5f,
                -0.5f, -0.5f,  0.5f,
                 0.5f, -0.5f,  0.5f
        };

        unsigned int cubeVAO, cubeVBO;
        glGenVertexArrays(1, &cubeVAO);
        glGenBuffers(1, &cubeVBO);
        glBindVertexArray(cubeVAO);
        glBindBuffer(GL_ARRAY_BUFFER,cubeVBO);
        glBufferData(GL_ARRAY_BUFFER, sizeof(vertices), vertices, GL_STATIC_DRAW);
        glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 6 * sizeof(float), (void*)0);
        glEnableVertexAttribArray(0);
        glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, 6 * sizeof(float), (void*)(3*sizeof(float)));
        glEnableVertexAttribArray(1);
        glBindVertexArray(0);

        unsigned int skyboxVAO, skyboxVBO;
        glGenVertexArrays(1, &skyboxVAO);
        glGenBuffers(1, &skyboxVBO);
        glBindVertexArray(skyboxVAO);
        glBindBuffer(GL_ARRAY_BUFFER, skyboxVBO);
        glBufferData(GL_ARRAY_BUFFER, sizeof(skyboxVertices), skyboxVertices, GL_STATIC_DRAW);
        glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 3 * sizeof(float), (void*)0);
        glEnableVertexAttribArray(0);
        glBindVertexArray(0);

        Shader shader("src/Shader/vertexShader.txt", "src/Shader/fragmentShader.txt");
        Shader skyboxShader("src/Shader/skyboxVertexShader.txt", "src/Shader/skyboxFragmentShader.txt");

        Model myModel("resources/objects/nanosuit_reflection/nanosuit.obj");

        unsigned int texture3 = loadCubemap(faces);

        shader.use();
        shader.setInt("skybox", 4);

        skyboxShader.use();
        skyboxShader.setInt("skybox", 0);

        while (!glfwWindowShouldClose(window)) {
                float currentFrame = (float)glfwGetTime();
                deltaTime = currentFrame - lastFrame;
                lastFrame = currentFrame;

                processInput(window);

                glClearColor(0.1, 0.1, 0.1, 1.0);
                glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

                skyboxShader.use();
                glDepthMask(GL_FALSE);
                glm::mat4 model = glm::mat4(1.0f);
                glm::mat4 view;
                view = glm::mat4(glm::mat3(camera.GetCameraView()));
                skyboxShader.setMatrix("view", view);
                glm::mat4 project = glm::perspective(glm::radians(camera.Zoom), (float)SCR_WIDTH / (float)SCR_HEIGHT, 0.1f, 100.0f);
                skyboxShader.setMatrix("project", project);
                glBindVertexArray(skyboxVAO);
                glActiveTexture(GL_TEXTURE0);
                glBindTexture(GL_TEXTURE_CUBE_MAP, texture3);
                glDrawArrays(GL_TRIANGLES, 0, 36);
                glBindVertexArray(0);
                glDepthMask(GL_TRUE);

                shader.use();
                shader.setVec3("viewPos", camera.Position);
                //glBindVertexArray(cubeVAO);
                glActiveTexture(GL_TEXTURE4);
                glBindTexture(GL_TEXTURE_CUBE_MAP, texture3);
                model = glm::translate(model, glm::vec3(-1.0f, -1.0f, -1.0f));
                model = glm::scale(model, glm::vec3(0.1f));
                shader.setMatrix("model", model);
                view = camera.GetCameraView();
                shader.setMatrix("view", view);
                shader.setMatrix("project", project);
                //glDrawArrays(GL_TRIANGLES, 0, 36);
                myModel.Draw(shader);

                //model = glm::mat4(1.0f);
                //model = glm::translate(model, glm::vec3(2.0f, 0.0f, 0.0f));
                //shader.setMatrix("model", model);
                //glDrawArrays(GL_TRIANGLES, 0, 36);
                //glBindVertexArray(0);

                glfwSwapBuffers(window);
                glfwPollEvents();
        }
        glDeleteVertexArrays(1, &cubeVAO);
        glDeleteBuffers(1, &cubeVBO);

        glfwTerminate();
        return 0;
}
```
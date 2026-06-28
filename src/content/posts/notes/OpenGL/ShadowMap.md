---
title: Shadow Mapping
published: 2026-06-28
description: 'Learn OpenGL 第五章第三节'
image: ''
tags: [OpenGL]
category: '学习笔记/OpenGL'
draft: false 
lang: 'zh'
---
# 光源空间坐标转换原理
使用光源的视图矩阵和投影矩阵，可以将场景中任意三维位置点变换到光源的可见坐标空间。
硬件会在投影矩阵计算完成后自动执行透视除法，将坐标从裁剪空间转换至 NDC 归一化设备空间。经过归一化处理后：坐标的 XY 分量用于采样阴影贴图，Z 分量代表当前片元相对于光源的真实深度值。
# 阴影贴图生成与特殊 FBO 配置规则
深度贴图（阴影贴图）的生成逻辑：从**光源视角渲染整个场景**，仅将场景深度数据存入深度纹理，最终得到一张记录光源可视深度信息的 Shadow Map。
生成阴影贴图需要自定义帧缓冲，且帧缓冲仅绑定**深度纹理附件**，无任何颜色附件。OpenGL 规范中，无颜色缓冲的帧缓冲会被判定为不完整帧缓冲，因此需要手动指定帧缓冲不启用颜色读写。
通过将读写缓冲目标设置为 **GL_NONE** 解决帧缓冲不完整问题。
FBO 读写缓冲区补充规则
- 普通单颜色附件 FBO、窗口默认渲染：无需手动设置，OpenGL 自动绑定COLOR0/BACK 缓冲。
- 需要手动调用 `glDrawBuffer / glReadBuffer` 三种特殊场景：多颜色附件 MRT 渲染、手动切换读写附件、纯深度无颜色渲染。
- 阴影贴图专属特例：仅挂载深度附件、无颜色附件的 FBO，是单附件场景中唯一需要手动设置 `GL_NONE` 的情况。
# 平行光阴影投影矩阵规则
制作平行光阴影贴图时，光源统一使用**正交投影矩阵**，贴合平行光无透视、光线平行照射的物理特性。
# 阴影投射与阴影接收的区分逻辑
- **阴影投射体**：深度贴图中记录的深度对应的物体，也就是能够产生阴影的物体。若物体/片元未参与深度贴图渲染，不会投射任何阴影。
- **阴影接收体**：通过采样深度贴图判断明暗的物体。若物体/片元未采样深度贴图，则不会接收任何阴影效果。
# 颜色缓冲与深度缓冲的生成、写入规则
## 颜色数据规则
颜色数据仅由片元着色器生成，硬件不会自动生成像素颜色。若片元着色器无输出颜色，GPU 不会填充颜色缓冲区，颜色缓冲会保留原有垃圾数据。
## 深度数据规则
深度数据默认来源于光栅化阶段插值后的片元 Z 坐标，**不由片元着色器生成**，但片元着色器可以手动修改深度值。
## 最终写入规则
将颜色、深度数据写入帧缓冲的操作均由硬件完成：
- 颜色：硬件读取片元着色器输出颜色，写入颜色缓冲。
- 深度：若片元着色器修改过深度，硬件读取着色器输出深度写入深度缓冲；否则直接使用光栅化插值的片元 Z 坐标。
# 阴影光照分量作用范围
由于现实中存在空气光散射效果，阴影并非纯黑。因此阴影效果**仅限制漫反射、镜面反射分量**，完全不作用于环境光分量，保证阴影区域保留基础环境亮度，效果更真实。
# 光源视锥体域外阴影异常修复方案
## 异常成因
片元处于光源正交视锥体范围外时，NDC 坐标会超出 `[-1,1]`  区间，转换后的纹理采样坐标超出 `[0,1]`。
若阴影纹理环绕模式为 **GL_REPEAT**，超出范围的坐标会循环采样有效区域纹理，导致视锥体域外本应完全受光的区域产生错误阴影。
## 解决方案
将阴影贴图纹理环绕模式改为 **GL_CLAMP_TO_BORDER**，并设置白色边框颜色。纹理坐标超出范围时，统一读取边框深度值 1.0。场景片元真实深度永远小于 1.0，域外片元深度测试永远通过，保持正常受光，彻底解决错误阴影问题。
## 边框颜色参数说明
边框颜色参数：`float borderColor[] = { 1.0, 1.0, 1.0, 1.0 }`
四个分量依次对应 RGBA 通道。由于深度贴图为单通道纹理，坐标越界时 OpenGL 仅读取第一个 R 分量作为深度值。
# 深度值线性化与深度比较核心误区纠正
无论是透视投影矩阵还是正交投影矩阵，**阴影深度比较不需要线性化深度值**，仅在可视化展示深度贴图时必须线性化。
- **closestDepth**：从阴影贴图采样得到的原始非线性窗口深度值。
- **currentDepth**：当前片元换算得到的同标准非线性窗口深度值。
二者处于同一套非线性坐标系，取值规则完全一致，可直接对比大小，对比结果绝对准确。
深度线性化仅用于将非线性深度值还原为真实物理距离，**不会改变数值大小关系**，因此不影响阴影判断逻辑。

# example1: 渲染深度贴图
阴影贴图可视化整体流程分为两个渲染 Pass：生成深度贴图、可视化深度贴图。
## Pass1：生成深度贴图
该阶段需要渲染完整场景，仅写入深度数据、不写入任何颜色数据。深度数据不输出到屏幕默认帧缓冲，而是渲染到自定义帧缓冲的深度纹理附件中，最终生成一张完整的场景深度贴图。
### 顶点着色器工作逻辑
负责将物体世界空间坐标变换至光源空间，运算依赖光源视线矩阵 + 光源投影矩阵，完成场景坐标的光源空间转换。
### 片元着色器工作逻辑
片元着色器无需输出颜色，保持空实现即可。深度数据由渲染管线硬件自动写入，无需着色器手动计算与输出。
## Pass2：可视化深度贴图
该阶段通过全屏四边形渲染，将上一阶段生成的深度贴图直接渲染至屏幕默认帧缓冲。四边形的每一个片元对深度贴图进行纹理采样，获取对应深度值，按需转换为线性灰度后输出画面。
## 平行光与非平行光
### 平行光（正交投影）
平行光采用正交投影矩阵，深度贴图中存储的窗口深度值本身就在 `[0~1]` 区间且完全线性，无需任何线性化处理，可直接将采样得到的深度值作为灰度颜色输出。
### 非平行光（透视投影）
非平行光采用透视投影矩阵，深度贴图中的窗口深度值虽处于 `[0~1]` 区间，但属于非线性深度。特点为：近处深度数值变化剧烈，远处深度数值变化极小。若直接可视化，画面绝大部分区域会呈现纯白色，深度层次被严重压缩，肉眼无法分辨梯度变化，因此必须进行深度线性化处理。
## 透视深度线性化
线性化的核心目的：将非线性窗口深度还原为符合真实物理距离的线性深度。
1. 逆归一化：将 `[0~1]` 的窗口深度还原为 `[-1,1]` 的 NDC 坐标；
2. 逆投影运算：通过逆投影矩阵将 NDC 坐标转换至相机视图空间，此时深度值为真实线性深度，范围 `[-near,-far]`；
3. 二次归一化：将视图空间线性深度重新映射至 `[0~1]` 区间，方可作为灰度值正常可视化输出。
本次案例基于平行光实现阴影效果，深度贴图深度值天然线性，因此直接采样深度值输出灰度画面即可，无需线性化处理。
![BQACAgUAAyEGAASHRsPbAAEWP6xqQQus84_7JqQEvBxrSOTPgHZmxQACSiMAAq3jCFYDt7C4psC32jwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWP6xqQQus84_7JqQEvBxrSOTPgHZmxQACSiMAAq3jCFYDt7C4psC32jwE.png)
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

unsigned int planeVAO;

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
unsigned int loadTexture(const char* path) {
        unsigned int texture;
        glGenTextures(1, &texture);
        glBindTexture(GL_TEXTURE_2D, texture);

        int width, height, nrChannels;
        unsigned char* data = stbi_load(path, &width, &height, &nrChannels, 0);
        if (data) {
                GLenum dataFormat;
                if (nrChannels == 1) {
                        dataFormat = GL_RED;
                }
                else if (nrChannels == 3) {
                        dataFormat = GL_RGB;
                }
                else if (nrChannels == 4) {
                        dataFormat = GL_RGBA;
                }
                glTexImage2D(GL_TEXTURE_2D, 0, dataFormat, width, height, 0, dataFormat, GL_UNSIGNED_BYTE, data);
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
unsigned int cubeVAO = 0;
unsigned int cubeVBO = 0;
void renderCube() {
        if (cubeVAO == 0) {//还没有创建VAO则创建，创建了就直接绑定
                float vertices[] = {
                        // back face
                        -1.0f, -1.0f, -1.0f,  0.0f,  0.0f, -1.0f, 0.0f, 0.0f, // bottom-left
                         1.0f,  1.0f, -1.0f,  0.0f,  0.0f, -1.0f, 1.0f, 1.0f, // top-right
                         1.0f, -1.0f, -1.0f,  0.0f,  0.0f, -1.0f, 1.0f, 0.0f, // bottom-right         
                         1.0f,  1.0f, -1.0f,  0.0f,  0.0f, -1.0f, 1.0f, 1.0f, // top-right
                        -1.0f, -1.0f, -1.0f,  0.0f,  0.0f, -1.0f, 0.0f, 0.0f, // bottom-left
                        -1.0f,  1.0f, -1.0f,  0.0f,  0.0f, -1.0f, 0.0f, 1.0f, // top-left
                        // front face
                        -1.0f, -1.0f,  1.0f,  0.0f,  0.0f,  1.0f, 0.0f, 0.0f, // bottom-left
                         1.0f, -1.0f,  1.0f,  0.0f,  0.0f,  1.0f, 1.0f, 0.0f, // bottom-right
                         1.0f,  1.0f,  1.0f,  0.0f,  0.0f,  1.0f, 1.0f, 1.0f, // top-right
                         1.0f,  1.0f,  1.0f,  0.0f,  0.0f,  1.0f, 1.0f, 1.0f, // top-right
                        -1.0f,  1.0f,  1.0f,  0.0f,  0.0f,  1.0f, 0.0f, 1.0f, // top-left
                        -1.0f, -1.0f,  1.0f,  0.0f,  0.0f,  1.0f, 0.0f, 0.0f, // bottom-left
                        // left face
                        -1.0f,  1.0f,  1.0f, -1.0f,  0.0f,  0.0f, 1.0f, 0.0f, // top-right
                        -1.0f,  1.0f, -1.0f, -1.0f,  0.0f,  0.0f, 1.0f, 1.0f, // top-left
                        -1.0f, -1.0f, -1.0f, -1.0f,  0.0f,  0.0f, 0.0f, 1.0f, // bottom-left
                        -1.0f, -1.0f, -1.0f, -1.0f,  0.0f,  0.0f, 0.0f, 1.0f, // bottom-left
                        -1.0f, -1.0f,  1.0f, -1.0f,  0.0f,  0.0f, 0.0f, 0.0f, // bottom-right
                        -1.0f,  1.0f,  1.0f, -1.0f,  0.0f,  0.0f, 1.0f, 0.0f, // top-right
                        // right face
                         1.0f,  1.0f,  1.0f,  1.0f,  0.0f,  0.0f, 1.0f, 0.0f, // top-left
                         1.0f, -1.0f, -1.0f,  1.0f,  0.0f,  0.0f, 0.0f, 1.0f, // bottom-right
                         1.0f,  1.0f, -1.0f,  1.0f,  0.0f,  0.0f, 1.0f, 1.0f, // top-right         
                         1.0f, -1.0f, -1.0f,  1.0f,  0.0f,  0.0f, 0.0f, 1.0f, // bottom-right
                         1.0f,  1.0f,  1.0f,  1.0f,  0.0f,  0.0f, 1.0f, 0.0f, // top-left
                         1.0f, -1.0f,  1.0f,  1.0f,  0.0f,  0.0f, 0.0f, 0.0f, // bottom-left     
                         // bottom face
                         -1.0f, -1.0f, -1.0f,  0.0f, -1.0f,  0.0f, 0.0f, 1.0f, // top-right
                          1.0f, -1.0f, -1.0f,  0.0f, -1.0f,  0.0f, 1.0f, 1.0f, // top-left
                          1.0f, -1.0f,  1.0f,  0.0f, -1.0f,  0.0f, 1.0f, 0.0f, // bottom-left
                          1.0f, -1.0f,  1.0f,  0.0f, -1.0f,  0.0f, 1.0f, 0.0f, // bottom-left
                         -1.0f, -1.0f,  1.0f,  0.0f, -1.0f,  0.0f, 0.0f, 0.0f, // bottom-right
                         -1.0f, -1.0f, -1.0f,  0.0f, -1.0f,  0.0f, 0.0f, 1.0f, // top-right
                         // top face
                         -1.0f,  1.0f, -1.0f,  0.0f,  1.0f,  0.0f, 0.0f, 1.0f, // top-left
                          1.0f,  1.0f , 1.0f,  0.0f,  1.0f,  0.0f, 1.0f, 0.0f, // bottom-right
                          1.0f,  1.0f, -1.0f,  0.0f,  1.0f,  0.0f, 1.0f, 1.0f, // top-right     
                          1.0f,  1.0f,  1.0f,  0.0f,  1.0f,  0.0f, 1.0f, 0.0f, // bottom-right
                         -1.0f,  1.0f, -1.0f,  0.0f,  1.0f,  0.0f, 0.0f, 1.0f, // top-left
                         -1.0f,  1.0f,  1.0f,  0.0f,  1.0f,  0.0f, 0.0f, 0.0f  // bottom-left
                };

                glGenVertexArrays(1, &cubeVAO);
                glBindVertexArray(cubeVAO);
                glGenBuffers(1, &cubeVBO);
                glBindBuffer(GL_ARRAY_BUFFER,cubeVBO);
                glBufferData(GL_ARRAY_BUFFER, sizeof(vertices), vertices, GL_STATIC_DRAW);
                glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 8 * sizeof(float), (void*)0);
                glEnableVertexAttribArray(0);
                glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, 8 * sizeof(float), (void*)(3 * sizeof(float)));
                glEnableVertexAttribArray(1);
                glVertexAttribPointer(2, 2, GL_FLOAT, GL_FALSE, 8 * sizeof(float), (void*)(6 * sizeof(float)));
                glEnableVertexAttribArray(2);
                glBindBuffer(GL_ARRAY_BUFFER, 0);
                glBindVertexArray(0);
        }
        glBindVertexArray(cubeVAO);
        glDrawArrays(GL_TRIANGLES, 0, 36);
        glBindVertexArray(0);
}
//后处理的全屏四边形
unsigned int quadVAO = 0;
unsigned int quadVBO = 0;
void renderQuad() {
        if (quadVAO == 0) {
                float quadVertices[] = {
                        // positions        // texture Coords
                        -1.0f,  1.0f, 0.0f, 0.0f, 1.0f,
                        -1.0f, -1.0f, 0.0f, 0.0f, 0.0f,
                         1.0f,  1.0f, 0.0f, 1.0f, 1.0f,
                         1.0f, -1.0f, 0.0f, 1.0f, 0.0f,
                };
                glGenVertexArrays(1, &quadVAO);
                glGenBuffers(1, &quadVBO);
                glBindVertexArray(quadVAO);
                glBindBuffer(GL_ARRAY_BUFFER, quadVBO);
                glBufferData(GL_ARRAY_BUFFER, sizeof(quadVertices), quadVertices, GL_STATIC_DRAW);
                glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 5 * sizeof(float), (void*)0);
                glEnableVertexAttribArray(0);
                glVertexAttribPointer(1, 2, GL_FLOAT, GL_FALSE, 5 * sizeof(float), (void*)(3 * sizeof(float)));
                glEnableVertexAttribArray(1);
                glBindBuffer(GL_ARRAY_BUFFER, 0);
                glBindVertexArray(0);
        }
        glBindVertexArray(quadVAO);
        glDrawArrays(GL_TRIANGLE_STRIP, 0, 4);
        //因为顶点数组只定义了四个顶点，所以必须使用三角形带的绘制模式，第三个参数表示一共要渲染几个顶点。前三和后三分别构成两个三角形
        //绘制模式可以改为三角形，这样顶点数组就必须是6个顶点
        glBindVertexArray(0);
}
void renderScene(const Shader& shader) {
        //floor
        glm::mat4 model = glm::mat4(1.0);
        shader.setMat4("model", model);
        glBindVertexArray(planeVAO);
        glDrawArrays(GL_TRIANGLES, 0, 6);

        //cubes
        model = glm::mat4(1.0f);
        model = glm::translate(model, glm::vec3(0.0f, 1.5f, 0.0f));
        model = glm::scale(model, glm::vec3(0.5f));
        shader.setMat4("model", model);
        renderCube();
        model = glm::mat4(1.0f);
        model = glm::translate(model, glm::vec3(2.0f, 0.0f, 1.0f));
        model = glm::scale(model, glm::vec3(0.5f));
        shader.setMat4("model", model);
        renderCube();
        model = glm::mat4(1.0f);
        model = glm::translate(model, glm::vec3(-1.0f, 0.0f, 2.0f));
        model = glm::rotate(model, glm::radians(60.0f), glm::normalize(glm::vec3(1.0f, 0.0f, 1.0f)));//旋转轴必须是单位向量，如果向量长度不为1，旋转矩阵会附带缩放效果，模型会被拉伸
        model = glm::scale(model, glm::vec3(0.25f));
        shader.setMat4("model", model);
        renderCube();
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

        //地面平面
        float planeVertices[] = {
                // positions            // normals         // texcoords
                 25.0f, -0.5f,  25.0f,  0.0f, 1.0f, 0.0f,  25.0f,  0.0f,
                -25.0f, -0.5f,  25.0f,  0.0f, 1.0f, 0.0f,   0.0f,  0.0f,
                -25.0f, -0.5f, -25.0f,  0.0f, 1.0f, 0.0f,   0.0f, 25.0f,

                 25.0f, -0.5f,  25.0f,  0.0f, 1.0f, 0.0f,  25.0f,  0.0f,
                -25.0f, -0.5f, -25.0f,  0.0f, 1.0f, 0.0f,   0.0f, 25.0f,
                 25.0f, -0.5f, -25.0f,  0.0f, 1.0f, 0.0f,  25.0f, 25.0f
        };

        unsigned int planeVBO;
        glGenVertexArrays(1, &planeVAO);
        glGenBuffers(1, &planeVBO);
        glBindVertexArray(planeVAO);
        glBindBuffer(GL_ARRAY_BUFFER, planeVBO);
        glBufferData(GL_ARRAY_BUFFER, sizeof(planeVertices), planeVertices, GL_STATIC_DRAW);
        glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 8 * sizeof(float), (void*)0);
        glEnableVertexAttribArray(0);
        glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, 8 * sizeof(float), (void*)(3 * sizeof(float)));
        glEnableVertexAttribArray(1);
        glVertexAttribPointer(2, 2, GL_FLOAT, GL_FALSE, 8 * sizeof(float), (void*)(6 * sizeof(float)));
        glEnableVertexAttribArray(2);
        glBindVertexArray(0);

        const unsigned int SHADOW_WIDTH = 1024, SHADOW_HEIGHT = 1024;
        unsigned int depthMapFBO;
        glGenFramebuffers(1, &depthMapFBO);
        
        unsigned int depthMap;
        glGenTextures(1, &depthMap);
        glBindTexture(GL_TEXTURE_2D, depthMap);
        glTexImage2D(GL_TEXTURE_2D, 0, GL_DEPTH_COMPONENT, SHADOW_WIDTH, SHADOW_HEIGHT, 0, GL_DEPTH_COMPONENT, GL_FLOAT, NULL);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_NEAREST);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_NEAREST);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_REPEAT);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_REPEAT);

        glBindFramebuffer(GL_FRAMEBUFFER, depthMapFBO);
        glFramebufferTexture2D(GL_FRAMEBUFFER, GL_DEPTH_ATTACHMENT, GL_TEXTURE_2D, depthMap, 0);//最后一个参数是mipmap层级，我们只用纹理第0层即原始分辨率
        glDrawBuffer(GL_NONE);
        glReadBuffer(GL_NONE);
        glBindFramebuffer(GL_FRAMEBUFFER, 0);

        //第一个Shader画场景，只写深度到深度图
        Shader simpleDepthShader("src/Shader/depthVertexShader.txt", "src/Shader/depthFragmentShader.txt");
        //第二个Shader画全屏四边形，从深度图采样深度
        Shader debugDepthQuad("src/Shader/vertexShader.txt", "src/Shader/fragmentShader.txt");

        unsigned int woodTexture = loadTexture("resources/textures/wood.jpg");

        debugDepthQuad.use();
        debugDepthQuad.setInt("depthMap", 0);

        float nearPlane = 1.0f;
        float farPlane = 7.5f;
        debugDepthQuad.setFloat("nearPlane", nearPlane);
        debugDepthQuad.setFloat("farPlane", farPlane);

        glm::vec3 lightPos(-2.0f, 4.0f, -1.0f);

        while (!glfwWindowShouldClose(window)) {
                float currentFrame = (float)glfwGetTime();
                deltaTime = currentFrame - lastFrame;
                lastFrame = currentFrame;

                processInput(window);

                glClearColor(0.1, 0.1, 0.1, 1.0);
                glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

                glm::mat4 lightProjection, lightView;
                glm::mat4 lightSpaceMatrix;
                lightProjection = glm::ortho(-10.0f, 10.0f, -10.0f, 10.0f, nearPlane, farPlane);
                lightView = glm::lookAt(lightPos, glm::vec3(0.0f), glm::vec3(0.0, 1.0, 0.0));
                lightSpaceMatrix = lightProjection * lightView;
                simpleDepthShader.use();
                simpleDepthShader.setMat4("lightSpaceMatrix", lightSpaceMatrix);

                glViewport(0, 0, SHADOW_WIDTH, SHADOW_HEIGHT);
                glBindFramebuffer(GL_FRAMEBUFFER, depthMapFBO);
                glClear(GL_DEPTH_BUFFER_BIT);
                glActiveTexture(GL_TEXTURE0);
                glBindTexture(GL_TEXTURE_2D, woodTexture);
                renderScene(simpleDepthShader);
                glBindFramebuffer(GL_FRAMEBUFFER, 0);

                glViewport(0, 0, SCR_WIDTH, SCR_HEIGHT);
                glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

                debugDepthQuad.use();
                glActiveTexture(GL_TEXTURE0);
                glBindTexture(GL_TEXTURE_2D, depthMap);
                renderQuad();

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
layout (location=0) in vec3 aPos;
layout (location=1) in vec2 aTexCoords;

out vec2 TexCoords;

void main(){
        TexCoords=aTexCoords;
        gl_Position=vec4(aPos,1.0);
}

//渲染全屏四边形
```
```glsl
//fragmentShader
#version 330 core
in vec2 TexCoords;
out vec4 FragColor;
uniform sampler2D depthMap;
uniform float near_plane;
uniform float far_plane;

float LinearizeDepth(float depth){//depth是窗口深度值0-1，硬件自动做了透视除法和归一化
        float z=depth*2.0-1.0;//逆归一化
        return (2.0*near_plane*far_plane)/(far_plane+near_plane-z*(far_plane-near_plane));//线性化
}

void main(){
        float depthValue=texture(depthMap,TexCoords).r;//texture采样结果是rgba四分量
        FragColor=vec4(vec3(depthValue),1.0);
}

//采样depthMap，把深度值转换为灰度图显示在屏幕上
```
```glsl
//depthVertexShader
#version 330 core
layout (location=0) in vec3 aPos;

uniform mat4 lightSpaceMatrix;
uniform mat4 model;

void main(){
        gl_Position=lightSpaceMatrix*model*vec4(aPos,1.0);
}

//把所有顶点变换到光源空间，那么裁剪空间的z坐标就是顶点到光源的真实深度
```
```glsl
//depthFragmentShader
#version 330 core
void main(){

}

//不输出颜色，深度由硬件自动写入
```
# example2: 渲染阴影
阴影渲染流程与深度贴图可视化流程的第一个 Pass 完全一致，二者核心区别仅体现在第二个 Pass。
## 公共 Pass1
统一渲染整个场景，仅生成、写入深度贴图，不输出颜色，完成光源场景深度信息采集。
## Pass2 
### 深度贴图可视化 Pass2
渲染全屏四边形，采样深度贴图输出灰度画面，无需场景光照计算。
### 真实阴影渲染 Pass2
不再渲染全屏四边形，而是重新渲染一次场景。该阶段不再只写入深度，而是正常写入场景颜色。因此顶点着色器与片元着色器需要额外承担光照计算、最终颜色输出的职责（常规光照计算逻辑已有教程详述，本文只聚焦阴影专属计算流程）。
#### 顶点着色器任务
将场景顶点坐标变换至光源裁剪空间，并将该裁剪空间坐标传递给片元着色器，为后续阴影采样计算提供数据。
#### 片元着色器任务
为获取深度贴图采样坐标，对传入的光源裁剪空间坐标执行透视除法，得到 NDC 空间坐标，再通过归一化换算得到屏幕坐标。
处理后的数据作用：
- 坐标 XY 值：用于采样深度贴图
- 坐标 Z 值：当前片元相对于光源、位于 `[0~1]` 区间的真实深度值
最终将深度贴图采样得到的深度值，与当前片元的光源深度值进行大小比对，计算出当前片元的阴影系数，完成阴影明暗计算。
下面仅展示了`main.cpp`，第二个pass的顶点着色器和片元着色器。第一个渲染深度贴图的pass的顶点着色器和片元着色器与上面的例子保持一致。
![BQACAgUAAyEGAASHRsPbAAEWP7NqQQytCrzKd8KLBn-1H6vM7jVczQACVyMAAq3jCFaDlkvZRSU4YTwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWP7NqQQytCrzKd8KLBn-1H6vM7jVczQACVyMAAq3jCFaDlkvZRSU4YTwE.png)
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

unsigned int planeVAO;

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
unsigned int loadTexture(const char* path) {
        unsigned int texture;
        glGenTextures(1, &texture);
        glBindTexture(GL_TEXTURE_2D, texture);

        int width, height, nrChannels;
        unsigned char* data = stbi_load(path, &width, &height, &nrChannels, 0);
        if (data) {
                GLenum dataFormat;
                if (nrChannels == 1) {
                        dataFormat = GL_RED;
                }
                else if (nrChannels == 3) {
                        dataFormat = GL_RGB;
                }
                else if (nrChannels == 4) {
                        dataFormat = GL_RGBA;
                }
                glTexImage2D(GL_TEXTURE_2D, 0, dataFormat, width, height, 0, dataFormat, GL_UNSIGNED_BYTE, data);
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
unsigned int cubeVAO = 0;
unsigned int cubeVBO = 0;
void renderCube() {
        if (cubeVAO == 0) {//还没有创建VAO则创建，创建了就直接绑定
                float vertices[] = {
                        // back face
                        -1.0f, -1.0f, -1.0f,  0.0f,  0.0f, -1.0f, 0.0f, 0.0f, // bottom-left
                         1.0f,  1.0f, -1.0f,  0.0f,  0.0f, -1.0f, 1.0f, 1.0f, // top-right
                         1.0f, -1.0f, -1.0f,  0.0f,  0.0f, -1.0f, 1.0f, 0.0f, // bottom-right         
                         1.0f,  1.0f, -1.0f,  0.0f,  0.0f, -1.0f, 1.0f, 1.0f, // top-right
                        -1.0f, -1.0f, -1.0f,  0.0f,  0.0f, -1.0f, 0.0f, 0.0f, // bottom-left
                        -1.0f,  1.0f, -1.0f,  0.0f,  0.0f, -1.0f, 0.0f, 1.0f, // top-left
                        // front face
                        -1.0f, -1.0f,  1.0f,  0.0f,  0.0f,  1.0f, 0.0f, 0.0f, // bottom-left
                         1.0f, -1.0f,  1.0f,  0.0f,  0.0f,  1.0f, 1.0f, 0.0f, // bottom-right
                         1.0f,  1.0f,  1.0f,  0.0f,  0.0f,  1.0f, 1.0f, 1.0f, // top-right
                         1.0f,  1.0f,  1.0f,  0.0f,  0.0f,  1.0f, 1.0f, 1.0f, // top-right
                        -1.0f,  1.0f,  1.0f,  0.0f,  0.0f,  1.0f, 0.0f, 1.0f, // top-left
                        -1.0f, -1.0f,  1.0f,  0.0f,  0.0f,  1.0f, 0.0f, 0.0f, // bottom-left
                        // left face
                        -1.0f,  1.0f,  1.0f, -1.0f,  0.0f,  0.0f, 1.0f, 0.0f, // top-right
                        -1.0f,  1.0f, -1.0f, -1.0f,  0.0f,  0.0f, 1.0f, 1.0f, // top-left
                        -1.0f, -1.0f, -1.0f, -1.0f,  0.0f,  0.0f, 0.0f, 1.0f, // bottom-left
                        -1.0f, -1.0f, -1.0f, -1.0f,  0.0f,  0.0f, 0.0f, 1.0f, // bottom-left
                        -1.0f, -1.0f,  1.0f, -1.0f,  0.0f,  0.0f, 0.0f, 0.0f, // bottom-right
                        -1.0f,  1.0f,  1.0f, -1.0f,  0.0f,  0.0f, 1.0f, 0.0f, // top-right
                        // right face
                         1.0f,  1.0f,  1.0f,  1.0f,  0.0f,  0.0f, 1.0f, 0.0f, // top-left
                         1.0f, -1.0f, -1.0f,  1.0f,  0.0f,  0.0f, 0.0f, 1.0f, // bottom-right
                         1.0f,  1.0f, -1.0f,  1.0f,  0.0f,  0.0f, 1.0f, 1.0f, // top-right         
                         1.0f, -1.0f, -1.0f,  1.0f,  0.0f,  0.0f, 0.0f, 1.0f, // bottom-right
                         1.0f,  1.0f,  1.0f,  1.0f,  0.0f,  0.0f, 1.0f, 0.0f, // top-left
                         1.0f, -1.0f,  1.0f,  1.0f,  0.0f,  0.0f, 0.0f, 0.0f, // bottom-left     
                         // bottom face
                         -1.0f, -1.0f, -1.0f,  0.0f, -1.0f,  0.0f, 0.0f, 1.0f, // top-right
                          1.0f, -1.0f, -1.0f,  0.0f, -1.0f,  0.0f, 1.0f, 1.0f, // top-left
                          1.0f, -1.0f,  1.0f,  0.0f, -1.0f,  0.0f, 1.0f, 0.0f, // bottom-left
                          1.0f, -1.0f,  1.0f,  0.0f, -1.0f,  0.0f, 1.0f, 0.0f, // bottom-left
                         -1.0f, -1.0f,  1.0f,  0.0f, -1.0f,  0.0f, 0.0f, 0.0f, // bottom-right
                         -1.0f, -1.0f, -1.0f,  0.0f, -1.0f,  0.0f, 0.0f, 1.0f, // top-right
                         // top face
                         -1.0f,  1.0f, -1.0f,  0.0f,  1.0f,  0.0f, 0.0f, 1.0f, // top-left
                          1.0f,  1.0f , 1.0f,  0.0f,  1.0f,  0.0f, 1.0f, 0.0f, // bottom-right
                          1.0f,  1.0f, -1.0f,  0.0f,  1.0f,  0.0f, 1.0f, 1.0f, // top-right     
                          1.0f,  1.0f,  1.0f,  0.0f,  1.0f,  0.0f, 1.0f, 0.0f, // bottom-right
                         -1.0f,  1.0f, -1.0f,  0.0f,  1.0f,  0.0f, 0.0f, 1.0f, // top-left
                         -1.0f,  1.0f,  1.0f,  0.0f,  1.0f,  0.0f, 0.0f, 0.0f  // bottom-left
                };

                glGenVertexArrays(1, &cubeVAO);
                glBindVertexArray(cubeVAO);
                glGenBuffers(1, &cubeVBO);
                glBindBuffer(GL_ARRAY_BUFFER,cubeVBO);
                glBufferData(GL_ARRAY_BUFFER, sizeof(vertices), vertices, GL_STATIC_DRAW);
                glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 8 * sizeof(float), (void*)0);
                glEnableVertexAttribArray(0);
                glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, 8 * sizeof(float), (void*)(3 * sizeof(float)));
                glEnableVertexAttribArray(1);
                glVertexAttribPointer(2, 2, GL_FLOAT, GL_FALSE, 8 * sizeof(float), (void*)(6 * sizeof(float)));
                glEnableVertexAttribArray(2);
                glBindBuffer(GL_ARRAY_BUFFER, 0);
                glBindVertexArray(0);
        }
        glBindVertexArray(cubeVAO);
        glDrawArrays(GL_TRIANGLES, 0, 36);
        glBindVertexArray(0);
}
void renderScene(const Shader& shader) {
        //floor
        glm::mat4 model = glm::mat4(1.0);
        shader.setMat4("model", model);
        glBindVertexArray(planeVAO);
        glDrawArrays(GL_TRIANGLES, 0, 6);

        //cubes
        model = glm::mat4(1.0f);
        model = glm::translate(model, glm::vec3(0.0f, 1.5f, 0.0f));
        model = glm::scale(model, glm::vec3(0.5f));
        shader.setMat4("model", model);
        renderCube();
        model = glm::mat4(1.0f);
        model = glm::translate(model, glm::vec3(2.0f, 0.0f, 1.0f));
        model = glm::scale(model, glm::vec3(0.5f));
        shader.setMat4("model", model);
        renderCube();
        model = glm::mat4(1.0f);
        model = glm::translate(model, glm::vec3(-1.0f, 0.0f, 2.0f));
        model = glm::rotate(model, glm::radians(60.0f), glm::normalize(glm::vec3(1.0f, 0.0f, 1.0f)));//旋转轴必须是单位向量，如果向量长度不为1，旋转矩阵会附带缩放效果，模型会被拉伸
        model = glm::scale(model, glm::vec3(0.25f));
        shader.setMat4("model", model);
        renderCube();
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

        glEnable(GL_DEPTH_TEST);

        //地面平面
        float planeVertices[] = {
                // positions            // normals         // texcoords
                 25.0f, -0.5f,  25.0f,  0.0f, 1.0f, 0.0f,  25.0f,  0.0f,
                -25.0f, -0.5f,  25.0f,  0.0f, 1.0f, 0.0f,   0.0f,  0.0f,
                -25.0f, -0.5f, -25.0f,  0.0f, 1.0f, 0.0f,   0.0f, 25.0f,

                 25.0f, -0.5f,  25.0f,  0.0f, 1.0f, 0.0f,  25.0f,  0.0f,
                -25.0f, -0.5f, -25.0f,  0.0f, 1.0f, 0.0f,   0.0f, 25.0f,
                 25.0f, -0.5f, -25.0f,  0.0f, 1.0f, 0.0f,  25.0f, 25.0f
        };

        unsigned int planeVBO;
        glGenVertexArrays(1, &planeVAO);
        glGenBuffers(1, &planeVBO);
        glBindVertexArray(planeVAO);
        glBindBuffer(GL_ARRAY_BUFFER, planeVBO);
        glBufferData(GL_ARRAY_BUFFER, sizeof(planeVertices), planeVertices, GL_STATIC_DRAW);
        glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 8 * sizeof(float), (void*)0);
        glEnableVertexAttribArray(0);
        glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, 8 * sizeof(float), (void*)(3 * sizeof(float)));
        glEnableVertexAttribArray(1);
        glVertexAttribPointer(2, 2, GL_FLOAT, GL_FALSE, 8 * sizeof(float), (void*)(6 * sizeof(float)));
        glEnableVertexAttribArray(2);
        glBindVertexArray(0);

        const unsigned int SHADOW_WIDTH = 1024, SHADOW_HEIGHT = 1024;
        unsigned int depthMapFBO;
        glGenFramebuffers(1, &depthMapFBO);
        
        unsigned int depthMap;
        glGenTextures(1, &depthMap);
        glBindTexture(GL_TEXTURE_2D, depthMap);
        glTexImage2D(GL_TEXTURE_2D, 0, GL_DEPTH_COMPONENT, SHADOW_WIDTH, SHADOW_HEIGHT, 0, GL_DEPTH_COMPONENT, GL_FLOAT, NULL);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_NEAREST);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_NEAREST);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_REPEAT);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_REPEAT);

        glBindFramebuffer(GL_FRAMEBUFFER, depthMapFBO);
        glFramebufferTexture2D(GL_FRAMEBUFFER, GL_DEPTH_ATTACHMENT, GL_TEXTURE_2D, depthMap, 0);//最后一个参数是mipmap层级，我们只用纹理第0层即原始分辨率
        glDrawBuffer(GL_NONE);
        glReadBuffer(GL_NONE);
        glBindFramebuffer(GL_FRAMEBUFFER, 0);

        //第一个Shader画场景，只写深度到深度图
        Shader simpleDepthShader("src/Shader/depthVertexShader.txt", "src/Shader/depthFragmentShader.txt");
        //第二个Shader画场景，从深度图采样
        Shader shader("src/Shader/vertexShader.txt", "src/Shader/fragmentShader.txt");

        unsigned int woodTexture = loadTexture("resources/textures/wood.jpg");

        shader.use();
        shader.setInt("depthMap", 0);
        shader.setInt("diffuseTexture", 1);
        glm::vec3 lightPos(-2.0f, 4.0f, -1.0f);
        shader.setVec3("lightPos", lightPos);

        float nearPlane = 1.0f;
        float farPlane = 7.5f;

        while (!glfwWindowShouldClose(window)) {
                float currentFrame = (float)glfwGetTime();
                deltaTime = currentFrame - lastFrame;
                lastFrame = currentFrame;

                processInput(window);

                glClearColor(0.1, 0.1, 0.1, 1.0);
                glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

                glm::mat4 lightProjection, lightView;
                glm::mat4 lightSpaceMatrix;
                lightProjection = glm::ortho(-10.0f, 10.0f, -10.0f, 10.0f, nearPlane, farPlane);
                lightView = glm::lookAt(lightPos, glm::vec3(0.0f), glm::vec3(0.0, 1.0, 0.0));
                lightSpaceMatrix = lightProjection * lightView;
                simpleDepthShader.use();
                simpleDepthShader.setMat4("lightSpaceMatrix", lightSpaceMatrix);

                glViewport(0, 0, SHADOW_WIDTH, SHADOW_HEIGHT);
                glBindFramebuffer(GL_FRAMEBUFFER, depthMapFBO);
                glClear(GL_DEPTH_BUFFER_BIT);
                renderScene(simpleDepthShader);
                glBindFramebuffer(GL_FRAMEBUFFER, 0);

                glViewport(0, 0, SCR_WIDTH, SCR_HEIGHT);
                glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

                shader.use();
                glm::mat4 projection = glm::perspective(glm::radians(camera.Zoom), (float)SCR_WIDTH / (float)SCR_HEIGHT, 0.1f, 100.0f);
                shader.setMat4("projection", projection);
                glm::mat4 view = camera.GetCameraView();
                shader.setMat4("view", view);
                shader.setMat4("lightSpaceMatrix", lightSpaceMatrix);
                shader.setVec3("viewPos", camera.Position);
                glActiveTexture(GL_TEXTURE0);
                glBindTexture(GL_TEXTURE_2D, depthMap);
                glActiveTexture(GL_TEXTURE1);
                glBindTexture(GL_TEXTURE_2D, woodTexture);
                renderScene(shader);

                glfwSwapBuffers(window);
                glfwPollEvents();
        }
        glDeleteVertexArrays(1, &planeVAO);
        glDeleteBuffers(1, &planeVBO);
        glfwTerminate();
        return 0;
}
```
```glsl
//vertexShader
#version 330 core
layout (location=0) in vec3 aPos;
layout (location=1) in vec3 aNormal;
layout (location=2) in vec2 aTexCoords;

out VS_OUT{
        vec3 FragPos;
        vec3 Normal;
        vec2 TexCoords;
        vec4 FragPosLightSpace;
} vs_out;

uniform mat4 projection;
uniform mat4 view;
uniform mat4 model;
uniform mat4 lightSpaceMatrix;

void main(){
        vs_out.FragPos=vec3(model*vec4(aPos,1.0));
        vs_out.Normal=mat3(transpose(inverse(model)))*aNormal;
        vs_out.TexCoords=aTexCoords;
        vs_out.FragPosLightSpace=lightSpaceMatrix*vec4(vs_out.FragPos,1.0);
        gl_Position=projection*view*vec4(vs_out.FragPos,1.0);
}

//渲染场景，把所有顶点变换到光源空间，那么裁剪空间的z坐标就是顶点到光源的真实深度
//并向片元着色器传递一些光照计算、颜色计算的参数
```
```glsl
//fragmentShader
#version 330 core
out vec4 FragColor;

in VS_OUT{
        vec3 FragPos;
        vec3 Normal;
        vec2 TexCoords;
        vec4 FragPosLightSpace;
} fs_in;

uniform sampler2D depthMap;
uniform sampler2D diffuseTexture;

uniform vec3 lightPos;
uniform vec3 viewPos;

float ShadowCalculation(vec4 fragPosLightSpace){
        //裁剪空间转NDC空间：做透视除法
        vec3 projCoords=fragPosLightSpace.xyz/fragPosLightSpace.w;
        //NDC空间转屏幕空间：归一化
        projCoords=projCoords*0.5+0.5;
        //使用屏幕空间坐标采样深度贴图
        float closestDepth=texture(depthMap,projCoords.xy).r;
        //获取当前片元的真实深度
        float currentDepth=projCoords.z;
        //两者进行比较，得到阴影系数
        float shadow=currentDepth > closestDepth?1.0:0.0;
        //shadow=1.0表示完全位于阴影中，shadow=0表示完全不位于阴影中
        return shadow;
}

void main(){
        vec3 color=texture(diffuseTexture,fs_in.TexCoords).rgb;
        vec3 normal=normalize(fs_in.Normal);
        vec3 lightColor=vec3(1.0);
        vec3 ambient=0.15*lightColor;
        vec3 lightDir=normalize(lightPos-fs_in.FragPos);
        float diff=max(dot(lightDir,normal),0.0);
        vec3 diffuse=diff*lightColor;

        vec3 viewDir=normalize(viewPos-fs_in.FragPos);
        float spec=0.0;
        vec3 halfDir=normalize(viewDir+lightDir);
        spec=pow(max(dot(halfDir,normal),0.0),64.0);
        vec3 specular=spec*lightColor;

        float shadow=ShadowCalculation(fs_in.FragPosLightSpace);
        vec3 lighting=ambient+(1-shadow)*(diffuse+specular)*color;

        FragColor=vec4(lighting,1.0);
}

//渲染场景，对每个片元，先采样深度贴图，得到当前点到光源的最近深度，与自己的深度比较
```
# example3: 修复阴影痤疮
可以看到渲染出的画面有非常多的摩尔纹。这些叫做**shadow acne**。产生的原因有两种：一是shadow map分辨率不够高，导致处于不同深度的相邻片元都采样到shadow map中的同一个texel，而一个texel只有一个深度，所以这些片元有的位于阴影中有的不位于阴影中，但是这些片元位于同一个表面，且由于相邻，他们应该都被照亮或都不被照亮。二是浮点误差，本是同一深度的相邻片元，由于计算精度误差，导致一个深度大于深度贴图中记录的深度，一个小于深度贴图中记录的深度，那么一个就位于阴影中，一个不位于阴影中，产生暗亮暗的条纹。
解决上面问题的思路是增加一个`bias`，或是对表面真实深度加或是对shadow map中存储的深度加。假如是对shadow map中存储的深度加一个偏移量，即相当于对表面真实深度减一个偏移量，则物体深度更小了。
![BQACAgUAAyEGAASHRsPbAAEWP7VqQQ0R4MyJ9opIzWvvJZhICrgwcQACWSMAAq3jCFYBhHqANcguUDwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWP7VqQQ0R4MyJ9opIzWvvJZhICrgwcQACWSMAAq3jCFYBhHqANcguUDwE.png)
```glsl
//fragmentShader
#version 330 core
out vec4 FragColor;

in VS_OUT{
        vec3 FragPos;
        vec3 Normal;
        vec2 TexCoords;
        vec4 FragPosLightSpace;
} fs_in;

uniform sampler2D depthMap;
uniform sampler2D diffuseTexture;

uniform vec3 lightPos;
uniform vec3 viewPos;

float ShadowCalculation(vec4 fragPosLightSpace){
        //裁剪空间转NDC空间：做透视除法
        vec3 projCoords=fragPosLightSpace.xyz/fragPosLightSpace.w;
        //NDC空间转屏幕空间：归一化
        projCoords=projCoords*0.5+0.5;
        //使用屏幕空间坐标采样深度贴图
        float closestDepth=texture(depthMap,projCoords.xy).r;
        //获取当前片元的真实深度
        float currentDepth=projCoords.z;
        //两者进行比较，得到阴影系数
        //添加偏移量以解决shadow acne
        float bias=0.005;
        float shadow=currentDepth-bias > closestDepth?1.0:0.0;
        //shadow=1.0表示完全位于阴影中，shadow=0表示完全不位于阴影中
        return shadow;
}

void main(){
        vec3 color=texture(diffuseTexture,fs_in.TexCoords).rgb;
        vec3 normal=normalize(fs_in.Normal);
        vec3 lightColor=vec3(1.0);
        vec3 ambient=0.15*lightColor;
        vec3 lightDir=normalize(lightPos-fs_in.FragPos);
        float diff=max(dot(lightDir,normal),0.0);
        vec3 diffuse=diff*lightColor;

        vec3 viewDir=normalize(viewPos-fs_in.FragPos);
        float spec=0.0;
        vec3 halfDir=normalize(viewDir+lightDir);
        spec=pow(max(dot(halfDir,normal),0.0),64.0);
        vec3 specular=spec*lightColor;

        float shadow=ShadowCalculation(fs_in.FragPosLightSpace);
        vec3 lighting=ambient+(1-shadow)*(diffuse+specular)*color;

        FragColor=vec4(lighting,1.0);
}

//渲染场景，对每个片元，先采样深度贴图，得到当前点到光源的最近深度，与自己的深度比较
```
但是在实际中，`bias`的大小和光源与表面的夹角相关，不能设置为定值。对于光源与表面垂直，同一表面上两个片元的深度差别很小，`bias`很小即可满足需求；对于光源和表面不垂直，光源照射方向越倾斜，同一表面上两个片元的深度差别越大，`bias`就需要越大。所以`bias`应该和`dot(lightDir,normal)`相关。
因为各个场景中合适的偏差值都不尽相同，所以可能需要经过一番调整后才能找到合适的偏移值，但大多情况下，实际上就是增加偏移量直到所有失真都被移除的问题。
![BQACAgUAAyEGAASHRsPbAAEWP7dqQQ1gblLEMSDMfTX9qplbQbZZ1AACWyMAAq3jCFYDs8vUzG0ITzwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWP7dqQQ1gblLEMSDMfTX9qplbQbZZ1AACWyMAAq3jCFYDs8vUzG0ITzwE.png)
```glsl
//fragmentShader
#version 330 core
out vec4 FragColor;

in VS_OUT{
        vec3 FragPos;
        vec3 Normal;
        vec2 TexCoords;
        vec4 FragPosLightSpace;
} fs_in;

uniform sampler2D depthMap;
uniform sampler2D diffuseTexture;

uniform vec3 lightPos;
uniform vec3 viewPos;

float ShadowCalculation(vec4 fragPosLightSpace,vec3 normal,vec3 lightDir){
        //裁剪空间转NDC空间：做透视除法
        vec3 projCoords=fragPosLightSpace.xyz/fragPosLightSpace.w;
        //NDC空间转屏幕空间：归一化
        projCoords=projCoords*0.5+0.5;
        //使用屏幕空间坐标采样深度贴图
        float closestDepth=texture(depthMap,projCoords.xy).r;
        //获取当前片元的真实深度
        float currentDepth=projCoords.z;
        //两者进行比较，得到阴影系数
        //添加偏移量以解决shadow acne
        float bias=max(0.05*(1.0-dot(normal,lightDir)),0.005);
        float shadow=currentDepth-bias > closestDepth?1.0:0.0;
        //shadow=1.0表示完全位于阴影中，shadow=0表示完全不位于阴影中
        return shadow;
}

void main(){
        vec3 color=texture(diffuseTexture,fs_in.TexCoords).rgb;
        vec3 normal=normalize(fs_in.Normal);
        vec3 lightColor=vec3(1.0);
        vec3 ambient=0.15*lightColor;
        vec3 lightDir=normalize(lightPos-fs_in.FragPos);
        float diff=max(dot(lightDir,normal),0.0);
        vec3 diffuse=diff*lightColor;

        vec3 viewDir=normalize(viewPos-fs_in.FragPos);
        float spec=0.0;
        vec3 halfDir=normalize(viewDir+lightDir);
        spec=pow(max(dot(halfDir,normal),0.0),64.0);
        vec3 specular=spec*lightColor;

        float shadow=ShadowCalculation(fs_in.FragPosLightSpace,normal,lightDir);
        vec3 lighting=ambient+(1-shadow)*(diffuse+specular)*color;

        FragColor=vec4(lighting,1.0);
}

//渲染场景，对每个片元，先采样深度贴图，得到当前点到光源的最近深度，与自己的深度比较
```
# example4: 修复阴影悬浮
但是`bias`过大会导致阴影悬浮，即物体和阴影分离了。解决方法是在渲染shadow map也就是第一个pass时，**剔除物体的正面，只渲染背面**。那么记录的也是背面的深度值，由于背面深度值比正面大，所以自然等价于给shadow map中的深度值加一个`bias`。这样就不再需要加很大的额外的`bias`，就减少了阴影悬浮的出现。
此外，地板作为Plane，只有单面，所以不能开启剔除，不然会直接消失。所以第一个pass渲染深度贴图时，渲染物体时开启面剔除并剔除正面，渲染地板时关闭面剔除。且引入面剔除之后，`bias`可以设置的小一些。
![BQACAgUAAyEGAASHRsPbAAEWP7lqQQ2zYEewk5Xlb_7Q6cJkIVqyzgACXSMAAq3jCFaZVKSE-vzVODwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWP7lqQQ2zYEewk5Xlb_7Q6cJkIVqyzgACXSMAAq3jCFaZVKSE-vzVODwE.png)
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

unsigned int planeVAO;

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
unsigned int loadTexture(const char* path) {
        unsigned int texture;
        glGenTextures(1, &texture);
        glBindTexture(GL_TEXTURE_2D, texture);

        int width, height, nrChannels;
        unsigned char* data = stbi_load(path, &width, &height, &nrChannels, 0);
        if (data) {
                GLenum dataFormat;
                if (nrChannels == 1) {
                        dataFormat = GL_RED;
                }
                else if (nrChannels == 3) {
                        dataFormat = GL_RGB;
                }
                else if (nrChannels == 4) {
                        dataFormat = GL_RGBA;
                }
                glTexImage2D(GL_TEXTURE_2D, 0, dataFormat, width, height, 0, dataFormat, GL_UNSIGNED_BYTE, data);
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
unsigned int cubeVAO = 0;
unsigned int cubeVBO = 0;
void renderCube() {
        if (cubeVAO == 0) {//还没有创建VAO则创建，创建了就直接绑定
                float vertices[] = {
                        // back face
                        -1.0f, -1.0f, -1.0f,  0.0f,  0.0f, -1.0f, 0.0f, 0.0f, // bottom-left
                         1.0f,  1.0f, -1.0f,  0.0f,  0.0f, -1.0f, 1.0f, 1.0f, // top-right
                         1.0f, -1.0f, -1.0f,  0.0f,  0.0f, -1.0f, 1.0f, 0.0f, // bottom-right         
                         1.0f,  1.0f, -1.0f,  0.0f,  0.0f, -1.0f, 1.0f, 1.0f, // top-right
                        -1.0f, -1.0f, -1.0f,  0.0f,  0.0f, -1.0f, 0.0f, 0.0f, // bottom-left
                        -1.0f,  1.0f, -1.0f,  0.0f,  0.0f, -1.0f, 0.0f, 1.0f, // top-left
                        // front face
                        -1.0f, -1.0f,  1.0f,  0.0f,  0.0f,  1.0f, 0.0f, 0.0f, // bottom-left
                         1.0f, -1.0f,  1.0f,  0.0f,  0.0f,  1.0f, 1.0f, 0.0f, // bottom-right
                         1.0f,  1.0f,  1.0f,  0.0f,  0.0f,  1.0f, 1.0f, 1.0f, // top-right
                         1.0f,  1.0f,  1.0f,  0.0f,  0.0f,  1.0f, 1.0f, 1.0f, // top-right
                        -1.0f,  1.0f,  1.0f,  0.0f,  0.0f,  1.0f, 0.0f, 1.0f, // top-left
                        -1.0f, -1.0f,  1.0f,  0.0f,  0.0f,  1.0f, 0.0f, 0.0f, // bottom-left
                        // left face
                        -1.0f,  1.0f,  1.0f, -1.0f,  0.0f,  0.0f, 1.0f, 0.0f, // top-right
                        -1.0f,  1.0f, -1.0f, -1.0f,  0.0f,  0.0f, 1.0f, 1.0f, // top-left
                        -1.0f, -1.0f, -1.0f, -1.0f,  0.0f,  0.0f, 0.0f, 1.0f, // bottom-left
                        -1.0f, -1.0f, -1.0f, -1.0f,  0.0f,  0.0f, 0.0f, 1.0f, // bottom-left
                        -1.0f, -1.0f,  1.0f, -1.0f,  0.0f,  0.0f, 0.0f, 0.0f, // bottom-right
                        -1.0f,  1.0f,  1.0f, -1.0f,  0.0f,  0.0f, 1.0f, 0.0f, // top-right
                        // right face
                         1.0f,  1.0f,  1.0f,  1.0f,  0.0f,  0.0f, 1.0f, 0.0f, // top-left
                         1.0f, -1.0f, -1.0f,  1.0f,  0.0f,  0.0f, 0.0f, 1.0f, // bottom-right
                         1.0f,  1.0f, -1.0f,  1.0f,  0.0f,  0.0f, 1.0f, 1.0f, // top-right         
                         1.0f, -1.0f, -1.0f,  1.0f,  0.0f,  0.0f, 0.0f, 1.0f, // bottom-right
                         1.0f,  1.0f,  1.0f,  1.0f,  0.0f,  0.0f, 1.0f, 0.0f, // top-left
                         1.0f, -1.0f,  1.0f,  1.0f,  0.0f,  0.0f, 0.0f, 0.0f, // bottom-left     
                         // bottom face
                         -1.0f, -1.0f, -1.0f,  0.0f, -1.0f,  0.0f, 0.0f, 1.0f, // top-right
                          1.0f, -1.0f, -1.0f,  0.0f, -1.0f,  0.0f, 1.0f, 1.0f, // top-left
                          1.0f, -1.0f,  1.0f,  0.0f, -1.0f,  0.0f, 1.0f, 0.0f, // bottom-left
                          1.0f, -1.0f,  1.0f,  0.0f, -1.0f,  0.0f, 1.0f, 0.0f, // bottom-left
                         -1.0f, -1.0f,  1.0f,  0.0f, -1.0f,  0.0f, 0.0f, 0.0f, // bottom-right
                         -1.0f, -1.0f, -1.0f,  0.0f, -1.0f,  0.0f, 0.0f, 1.0f, // top-right
                         // top face
                         -1.0f,  1.0f, -1.0f,  0.0f,  1.0f,  0.0f, 0.0f, 1.0f, // top-left
                          1.0f,  1.0f , 1.0f,  0.0f,  1.0f,  0.0f, 1.0f, 0.0f, // bottom-right
                          1.0f,  1.0f, -1.0f,  0.0f,  1.0f,  0.0f, 1.0f, 1.0f, // top-right     
                          1.0f,  1.0f,  1.0f,  0.0f,  1.0f,  0.0f, 1.0f, 0.0f, // bottom-right
                         -1.0f,  1.0f, -1.0f,  0.0f,  1.0f,  0.0f, 0.0f, 1.0f, // top-left
                         -1.0f,  1.0f,  1.0f,  0.0f,  1.0f,  0.0f, 0.0f, 0.0f  // bottom-left
                };

                glGenVertexArrays(1, &cubeVAO);
                glBindVertexArray(cubeVAO);
                glGenBuffers(1, &cubeVBO);
                glBindBuffer(GL_ARRAY_BUFFER,cubeVBO);
                glBufferData(GL_ARRAY_BUFFER, sizeof(vertices), vertices, GL_STATIC_DRAW);
                glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 8 * sizeof(float), (void*)0);
                glEnableVertexAttribArray(0);
                glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, 8 * sizeof(float), (void*)(3 * sizeof(float)));
                glEnableVertexAttribArray(1);
                glVertexAttribPointer(2, 2, GL_FLOAT, GL_FALSE, 8 * sizeof(float), (void*)(6 * sizeof(float)));
                glEnableVertexAttribArray(2);
                glBindBuffer(GL_ARRAY_BUFFER, 0);
                glBindVertexArray(0);
        }
        glBindVertexArray(cubeVAO);
        glDrawArrays(GL_TRIANGLES, 0, 36);
        glBindVertexArray(0);
}
void renderScene(const Shader& shader) {
        //floor
        glm::mat4 model = glm::mat4(1.0);
        shader.setMat4("model", model);
        glBindVertexArray(planeVAO);
        glDrawArrays(GL_TRIANGLES, 0, 6);

        //cubes
        model = glm::mat4(1.0f);
        model = glm::translate(model, glm::vec3(0.0f, 1.5f, 0.0f));
        model = glm::scale(model, glm::vec3(0.5f));
        shader.setMat4("model", model);
        renderCube();
        model = glm::mat4(1.0f);
        model = glm::translate(model, glm::vec3(2.0f, 0.0f, 1.0f));
        model = glm::scale(model, glm::vec3(0.5f));
        shader.setMat4("model", model);
        renderCube();
        model = glm::mat4(1.0f);
        model = glm::translate(model, glm::vec3(-1.0f, 0.0f, 2.0f));
        model = glm::rotate(model, glm::radians(60.0f), glm::normalize(glm::vec3(1.0f, 0.0f, 1.0f)));//旋转轴必须是单位向量，如果向量长度不为1，旋转矩阵会附带缩放效果，模型会被拉伸
        model = glm::scale(model, glm::vec3(0.25f));
        shader.setMat4("model", model);
        renderCube();
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

        glEnable(GL_DEPTH_TEST);

        //地面平面
        float planeVertices[] = {
                // positions            // normals         // texcoords
                 25.0f, -0.5f,  25.0f,  0.0f, 1.0f, 0.0f,  25.0f,  0.0f,
                -25.0f, -0.5f,  25.0f,  0.0f, 1.0f, 0.0f,   0.0f,  0.0f,
                -25.0f, -0.5f, -25.0f,  0.0f, 1.0f, 0.0f,   0.0f, 25.0f,

                 25.0f, -0.5f,  25.0f,  0.0f, 1.0f, 0.0f,  25.0f,  0.0f,
                -25.0f, -0.5f, -25.0f,  0.0f, 1.0f, 0.0f,   0.0f, 25.0f,
                 25.0f, -0.5f, -25.0f,  0.0f, 1.0f, 0.0f,  25.0f, 25.0f
        };

        unsigned int planeVBO;
        glGenVertexArrays(1, &planeVAO);
        glGenBuffers(1, &planeVBO);
        glBindVertexArray(planeVAO);
        glBindBuffer(GL_ARRAY_BUFFER, planeVBO);
        glBufferData(GL_ARRAY_BUFFER, sizeof(planeVertices), planeVertices, GL_STATIC_DRAW);
        glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 8 * sizeof(float), (void*)0);
        glEnableVertexAttribArray(0);
        glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, 8 * sizeof(float), (void*)(3 * sizeof(float)));
        glEnableVertexAttribArray(1);
        glVertexAttribPointer(2, 2, GL_FLOAT, GL_FALSE, 8 * sizeof(float), (void*)(6 * sizeof(float)));
        glEnableVertexAttribArray(2);
        glBindVertexArray(0);

        const unsigned int SHADOW_WIDTH = 1024, SHADOW_HEIGHT = 1024;
        unsigned int depthMapFBO;
        glGenFramebuffers(1, &depthMapFBO);
        
        unsigned int depthMap;
        glGenTextures(1, &depthMap);
        glBindTexture(GL_TEXTURE_2D, depthMap);
        glTexImage2D(GL_TEXTURE_2D, 0, GL_DEPTH_COMPONENT, SHADOW_WIDTH, SHADOW_HEIGHT, 0, GL_DEPTH_COMPONENT, GL_FLOAT, NULL);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_NEAREST);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_NEAREST);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_REPEAT);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_REPEAT);

        glBindFramebuffer(GL_FRAMEBUFFER, depthMapFBO);
        glFramebufferTexture2D(GL_FRAMEBUFFER, GL_DEPTH_ATTACHMENT, GL_TEXTURE_2D, depthMap, 0);//最后一个参数是mipmap层级，我们只用纹理第0层即原始分辨率
        glDrawBuffer(GL_NONE);
        glReadBuffer(GL_NONE);
        glBindFramebuffer(GL_FRAMEBUFFER, 0);

        //第一个Shader画场景，只写深度到深度图
        Shader simpleDepthShader("src/Shader/depthVertexShader.txt", "src/Shader/depthFragmentShader.txt");
        //第二个Shader画场景，从深度图采样
        Shader shader("src/Shader/vertexShader.txt", "src/Shader/fragmentShader.txt");

        unsigned int woodTexture = loadTexture("resources/textures/wood.jpg");

        shader.use();
        shader.setInt("depthMap", 0);
        shader.setInt("diffuseTexture", 1);
        glm::vec3 lightPos(-2.0f, 4.0f, -1.0f);
        shader.setVec3("lightPos", lightPos);

        float nearPlane = 1.0f;
        float farPlane = 7.5f;

        while (!glfwWindowShouldClose(window)) {
                float currentFrame = (float)glfwGetTime();
                deltaTime = currentFrame - lastFrame;
                lastFrame = currentFrame;

                processInput(window);

                glClearColor(0.1, 0.1, 0.1, 1.0);
                glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

                glm::mat4 lightProjection, lightView;
                glm::mat4 lightSpaceMatrix;
                lightProjection = glm::ortho(-10.0f, 10.0f, -10.0f, 10.0f, nearPlane, farPlane);
                lightView = glm::lookAt(lightPos, glm::vec3(0.0f), glm::vec3(0.0, 1.0, 0.0));
                lightSpaceMatrix = lightProjection * lightView;
                simpleDepthShader.use();
                simpleDepthShader.setMat4("lightSpaceMatrix", lightSpaceMatrix);

                glViewport(0, 0, SHADOW_WIDTH, SHADOW_HEIGHT);
                glEnable(GL_CULL_FACE);
                glCullFace(GL_FRONT);
                glBindFramebuffer(GL_FRAMEBUFFER, depthMapFBO);
                glClear(GL_DEPTH_BUFFER_BIT);
                //renderScene(simpleDepthShader);
                glm::mat4 model = glm::mat4(1.0f);
                model = glm::translate(model, glm::vec3(0.0f, 1.5f, 0.0f));
                model = glm::scale(model, glm::vec3(0.5f));
                simpleDepthShader.setMat4("model", model);
                renderCube();

                model = glm::mat4(1.0f);
                model = glm::translate(model, glm::vec3(2.0f, 0.0f, 1.0f));
                model = glm::scale(model, glm::vec3(0.5f));
                simpleDepthShader.setMat4("model", model);
                renderCube();

                model = glm::mat4(1.0f);
                model = glm::translate(model, glm::vec3(-1.0f, 0.0f, 2.0f));
                model = glm::rotate(model, glm::radians(60.0f), glm::normalize(glm::vec3(1.0f, 0.0f, 1.0f)));
                model = glm::scale(model, glm::vec3(0.25f));
                simpleDepthShader.setMat4("model", model);
                renderCube();

                glDisable(GL_CULL_FACE);
                model = glm::mat4(1.0);
                simpleDepthShader.setMat4("model", model);
                glBindVertexArray(planeVAO);
                glDrawArrays(GL_TRIANGLES, 0, 6);
                glBindFramebuffer(GL_FRAMEBUFFER, 0);

                glViewport(0, 0, SCR_WIDTH, SCR_HEIGHT);
                glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

                shader.use();
                glm::mat4 projection = glm::perspective(glm::radians(camera.Zoom), (float)SCR_WIDTH / (float)SCR_HEIGHT, 0.1f, 100.0f);
                shader.setMat4("projection", projection);
                glm::mat4 view = camera.GetCameraView();
                shader.setMat4("view", view);
                shader.setMat4("lightSpaceMatrix", lightSpaceMatrix);
                shader.setVec3("viewPos", camera.Position);
                glActiveTexture(GL_TEXTURE0);
                glBindTexture(GL_TEXTURE_2D, depthMap);
                glActiveTexture(GL_TEXTURE1);
                glBindTexture(GL_TEXTURE_2D, woodTexture);
                renderScene(shader);

                glfwSwapBuffers(window);
                glfwPollEvents();
        }
        glDeleteVertexArrays(1, &planeVAO);
        glDeleteBuffers(1, &planeVBO);
        glfwTerminate();
        return 0;
}
```
可以看到接近阴影面的物体仍然可能会出现不正确的效果。但一般来说，通过常规的偏移值调整就足以解决阴影偏移的问题了。（而且似乎我设置了面剔除来解决阴影悬浮之前，没有出现阴影悬浮（因为`bias`较小），但是设置之后，反而出现了阴影悬浮，我也不太清楚为什么）
# example5: 渲染光源视锥体之外的区域
在纹理环绕模式为`GL_REPEAT`的情况下，**光源视锥体之外的片元**会采样到shadow map中有效深度，进而产生阴影：
![BQACAgUAAyEGAASHRsPbAAEWP7xqQQ4GJt6Vq43Pjo_DkqyPBQZtfgACYCMAAq3jCFaSrgyi0VV2ZDwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWP7xqQQ4GJt6Vq43Pjo_DkqyPBQZtfgACYCMAAq3jCFaSrgyi0VV2ZDwE.png)
```c
//main.cpp
unsigned int depthMap;
glGenTextures(1, &depthMap);
glBindTexture(GL_TEXTURE_2D, depthMap);
glTexImage2D(GL_TEXTURE_2D, 0, GL_DEPTH_COMPONENT, SHADOW_WIDTH, SHADOW_HEIGHT, 0, GL_DEPTH_COMPONENT, GL_FLOAT, NULL);
glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_REPEAT);
glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_REPEAT);
```
我们可以将纹理环绕模式设置为`GL_CLAMP_TO_BORDER`来使得**光源视锥体之外的片元总是处于光亮之中**。
![BQACAgUAAyEGAASHRsPbAAEWP75qQQ5AqQO-UR3QrAScugyPgD0m1QACYiMAAq3jCFb8wdEiWJkSEDwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWP75qQQ5AqQO-UR3QrAScugyPgD0m1QACYiMAAq3jCFb8wdEiWJkSEDwE.png)
```c
//main.cpp
unsigned int depthMap;
glGenTextures(1, &depthMap);
glBindTexture(GL_TEXTURE_2D, depthMap);
glTexImage2D(GL_TEXTURE_2D, 0, GL_DEPTH_COMPONENT, SHADOW_WIDTH, SHADOW_HEIGHT, 0, GL_DEPTH_COMPONENT, GL_FLOAT, NULL);
glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_BORDER);
glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_BORDER);
float borderColor[] = { 1.0,1.0,1.0,1.0 };
glTexParameterfv(GL_TEXTURE_2D, GL_TEXTURE_BORDER_COLOR, borderColor);
```
可以看到视野中仍然有一部分区域位于阴影中，这部分区域位于光源视锥体的远平面之外。`CLAMP_TO_BORDER`只能限制`XY`边界，这部分区域变黑是因为`Z`坐标超出了远平面，但`XY`坐标位于`[0,1]`之内，正常采样，只是采样得到的深度值总是比自身深度值要小，那么这部分区域总是位于阴影中。解决思路是**把这部分的shadow分量直接置为0**，表示这部分区域永远不会处于阴影中。在游戏开发过程中，不产生阴影的部分通常只会出现在远方，相比于此前让远方漆黑一片的做法，这种处理更合理一些。
![BQACAgUAAyEGAASHRsPbAAEWP8hqQQ6LukouDgFHiMR9oaHFJhMYtAACbCMAAq3jCFaPWf_knqNj6jwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWP8hqQQ6LukouDgFHiMR9oaHFJhMYtAACbCMAAq3jCFaPWf_knqNj6jwE.png)
```glsl
//fragmentShader
float ShadowCalculation(vec4 fragPosLightSpace,vec3 normal,vec3 lightDir){
        //裁剪空间转NDC空间：做透视除法
        vec3 projCoords=fragPosLightSpace.xyz/fragPosLightSpace.w;
        //NDC空间转屏幕空间：归一化
        projCoords=projCoords*0.5+0.5;
        if(projCoords.z>1.0){
                return 0.0;
        }
        //使用屏幕空间坐标采样深度贴图
        float closestDepth=texture(depthMap,projCoords.xy).r;
        //获取当前片元的真实深度
        float currentDepth=projCoords.z;
        //两者进行比较，得到阴影系数
        //添加偏移量以解决shadow acne
        float bias=max(0.05*(1.0-dot(lightDir,normal)),0.005);
        float shadow=currentDepth-bias > closestDepth?1.0:0.0;
        //shadow=1.0表示完全位于阴影中，shadow=0表示完全不位于阴影中
        return shadow;
}
```
# example6: PCF
通过之前的渲染图片可以发现，阴影边缘的锯齿状较为严重。这是因为shadow map分辨率不够高，多个片元采样到同一个texel，采样到同一个深度，而texel是正方形的，所以渲染出来的阴影也是正方形的，即这一小块正方形内的片元采样到了同一个深度。
解决办法就是**PCF，即多次采样取平均**。这里的平均不是深度平均而是**阴影系数的平均**，遍历当前片元所在texel的周围八个texel，取他们在shadow map中的深度，与当前片元的真实深度比较，这样得到了九个shadow系数（0表示完全不在阴影中，1表示完全在阴影中），取平均，得到`0-1`的shadow系数。
```glsl
//fragmentShader
float ShadowCalculation(vec4 fragPosLightSpace,vec3 normal,vec3 lightDir){
        //裁剪空间转NDC空间：做透视除法
        vec3 projCoords=fragPosLightSpace.xyz/fragPosLightSpace.w;
        //NDC空间转屏幕空间：归一化
        projCoords=projCoords*0.5+0.5;
        if(projCoords.z>1.0){
                return 0.0;
        }
        //获取当前片元的真实深度
        float currentDepth=projCoords.z;
        //获取深度贴图中的深度值并添加bias
        float bias=max(0.05*(1.0-dot(lightDir,normal)),0.005);
        //PCF
        vec2 texelSize=1.0/textureSize(depthMap,0);//返回第0级shadow map的宽高，取倒数得到一个纹素的大小
        //遍历当前texel周围3*3个texel
        float shadow=0.0;
        for(int x=-1;x<=1;x++){
                for(int y=-1;y<=1;y++){
                        float pcfDepth=texture(depthMap,projCoords.xy+vec2(x,y)*texelSize).r;
                        shadow+=currentDepth-bias > pcfDepth?1.0:0.0;//shadow=1.0表示完全位于阴影中，shadow=0表示完全不位于阴影中
                }
        }
        shadow/=9.0;
        return shadow;
}
```
从较远的地方看，阴影边缘模糊了一些，锯齿没那么明显了：
![BQACAgUAAyEGAASHRsPbAAEWP8xqQQ7v-DNXwm56tqz4qhTaTYzs4wACcCMAAq3jCFa9yzOxMzduRTwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWP8xqQQ7v-DNXwm56tqz4qhTaTYzs4wACcCMAAq3jCFa9yzOxMzduRTwE.png)
从近的地方看，阴影边缘还是有一些不真实：
![BQACAgUAAyEGAASHRsPbAAEWP81qQQ8M51e3UdZBKrqTvYKH_MRT6gACcSMAAq3jCFYkrF3pn68BpzwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWP81qQQ8M51e3UdZBKrqTvYKH_MRT6gACcSMAAq3jCFYkrF3pn68BpzwE.png)
# example7: 透视投影的光源的阴影
把`lightProjection`改成`perspective`
![BQACAgUAAyEGAASHRsPbAAEWP85qQQ842_caOxC5mNg4_4T4IYxx4QACciMAAq3jCFZPWFhu5vfjRTwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWP85qQQ842_caOxC5mNg4_4T4IYxx4QACciMAAq3jCFZPWFhu5vfjRTwE.png)
```c
//main.cpp
lightProjection = glm::perspective(glm::radians(90.0f), 1.0f, nearPlane, farPlane);
```
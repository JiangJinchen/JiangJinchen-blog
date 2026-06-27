---
title: Blend
published: 2026-06-27
description: 'Learn OpenGL 第四章第三节'
image: ''
tags: [OpenGL]
category: '学习笔记/OpenGL'
draft: false 
lang: 'zh'
---
# 片元丢弃 discard
在**片元着色器**中，可使用 `discard` 指令进行条件片元剔除：满足自定义条件时，直接丢弃当前正在处理的片元，该片元不会进入后续测试、混合与写入流程，常用于镂空贴图、不规则透明裁剪效果。
# 颜色混合（Blend）执行时机
颜色混合是渲染管线**最后阶段**之一，执行顺序严格为：
**片元着色器执行 → 模板测试、深度测试全部完成 → 颜色混合**
只有通过所有测试的片元，才会参与颜色混合运算，最终写入颜色缓冲。
# 混合原理
- **源颜色（Source Color）**：当前片元着色器输出、纹理采样得到的新颜色
- **目标颜色（Destination Color）**：当前像素在颜色缓冲中已经存在的旧颜色
混合方程用于定义：**源颜色与目标颜色如何加权叠加**。其中源、目标颜色由 OpenGL 自动赋值，开发者可手动配置**混合因子**控制混合权重。
# 混合因子配置函数
## glBlendFunc
统一设置 RGB 通道与 Alpha 通道混合规则：RGB、Alpha 通道共用同一套源因子、目标因子。
参数：`glBlendFunc(源因子, 目标因子)`
## glBlendFuncSeparate
分离通道设置，**RGB 通道与 Alpha 通道可以使用不同混合因子**，灵活度更高。
参数顺序：
1. 源颜色 RGB 混合因子
2. 目标颜色 RGB 混合因子
3. 源颜色 Alpha 混合因子
4. 目标颜色 Alpha 混合因子
# 混合运算方程设置
`glBlendEquation()`
用于设置源颜色与目标颜色的**运算方式**，默认模式为**相加**，也可配置相减、取最值等运算规则。
# 次序无关透明度（OIT）
## 传统透明渲染的问题
传统透明渲染需要 CPU 将透明物体**由远至近**排序，存在诸多无法解决的问题：
- 模型、面片数量庞大时，CPU 排序开销极高、帧率下降
- 物体交叉、互相穿透时，不存在全局正确的渲染顺序
- 动态场景每帧物体位置变化，需要每帧重新排序，开销巨大
## OIT 核心思想
将透明排序逻辑从 CPU 转移至 GPU：GPU 每帧收集单个像素上所有覆盖的透明片元，自动排序、混合，彻底摆脱手动排序依赖。
## 精确 OIT 方案
- **深度剥离**：根据片元距相机距离分层，每次仅渲染当前最近一层透明片元，从前往后逐层混合，结果精准，但需要多 Pass 渲染。
- **逐像素链表**：单次渲染遍历，为每个像素开辟链表存储所有透明片元数据，渲染结束后统一遍历链表排序、混合，精度最高。
## 近似 OIT 方案
不存储全部透明片元数据，仅累积**带权重的颜色与透明度**。权重规则：近处物体、不透明区域权重更大，对最终颜色贡献更强。仅需**单次 Pass** 即可完成透明渲染，性能极高，属于近似拟合方案。

# example1: 透明度测试
实现简易版草丛：将带有透明度通道的草纹理贴在四边形面片上；在着色器中判断当前片元的透明度，如果透明度低于某个值就将其丢弃。
*在实现上*：我们首先定义了一个四边形面片的六个顶点位置坐标以及纹理坐标，然后定义了面片的位置。设定`VAO`与`VBO`，传递数据，然后在渲染循环中绘制。在片元着色器中，读取当前纹理颜色的`alpha`值，如果小于`0.1`（不是`-==0`，浮点数比较有精度问题），则使用`discard`命令丢弃这个片元。
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

    Shader shader("src/Shader/vertexShader.txt", "src/Shader/fragmentShader.txt");

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

    float transparentVertices[] = {
        0.0f,  0.5f,  0.0f,  0.0f,  1.0f,//左上
        0.0f, -0.5f,  0.0f,  0.0f,  0.0f,//左下
        1.0f, -0.5f,  0.0f,  1.0f,  0.0f,//右下

        0.0f,  0.5f,  0.0f,  0.0f,  1.0f,//左上
        1.0f, -0.5f,  0.0f,  1.0f,  0.0f,//右下
        1.0f,  0.5f,  0.0f,  1.0f,  1.0f//右上
    };

    vector<glm::vec3> vegetation{
        glm::vec3(-1.5f, 0.0f, -0.48f),
        glm::vec3(1.5f, 0.0f, 0.51f),
        glm::vec3(0.0f, 0.0f, 0.7f),
        glm::vec3(-0.3f, 0.0f, -2.3f),
        glm::vec3(0.5f, 0.0f, -0.6f)
    };

    unsigned int cubeVAO, cubeVBO;
    glGenVertexArrays(1, &cubeVAO);
    glGenBuffers(1, &cubeVBO);

    glBindVertexArray(cubeVAO);
    glBindBuffer(GL_ARRAY_BUFFER, cubeVBO);
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
    glBindBuffer(GL_ARRAY_BUFFER, planeVBO);
    glBufferData(GL_ARRAY_BUFFER, sizeof(planeVertices), planeVertices, GL_STATIC_DRAW);

    glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 5 * sizeof(float), (void*)0);
    glEnableVertexAttribArray(0);

    glVertexAttribPointer(1, 2, GL_FLOAT, GL_FALSE, 5 * sizeof(float), (void*)(3 * sizeof(float)));
    glEnableVertexAttribArray(1);

    glBindVertexArray(0);

    unsigned int transparentVAO, transparentVBO;
    glGenVertexArrays(1, &transparentVAO);
    glGenBuffers(1, &transparentVBO);

    glBindVertexArray(transparentVAO);
    glBindBuffer(GL_ARRAY_BUFFER, transparentVBO);

    glBufferData(GL_ARRAY_BUFFER, sizeof(transparentVertices), transparentVertices, GL_STATIC_DRAW);
    
    glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 5 * sizeof(float), (void*)0);
    glEnableVertexAttribArray(0);
    glVertexAttribPointer(1, 2, GL_FLOAT, GL_FALSE, 5 * sizeof(float), (void*)(3 * sizeof(float)));
    glEnableVertexAttribArray(1);

    glBindVertexArray(0);

    unsigned int cubeTexture = loadTexture("resources/textures/marble.jpg");
    unsigned int floorTexture = loadTexture("resources/textures/metal.jpg");
    unsigned int grassTexture = loadTexture("resources/textures/grass.png");

    shader.use();
    shader.setInt("texture1", 0);
    shader.setInt("texture2", 1);
    shader.setInt("texture3", 2);

    while (!glfwWindowShouldClose(window)) {
        float currentFrame = (float)glfwGetTime();
        deltaTime = currentFrame - lastFrame;
        lastFrame = currentFrame;

        processInput(window);

        glClearColor(0.1f, 0.1f, 0.1f, 1.0f);
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

        shader.use();
        glm::mat4 model = glm::mat4(1.0f);
        glm::mat4 view = camera.GetCameraView();
        glm::mat4 project = glm::perspective(glm::radians(camera.Zoom), (float)SCR_WIDTH / (float)SCR_HEIGHT, 0.1f, 100.0f);
        shader.setMatrix("view", view);
        shader.setMatrix("project", project);

        glBindVertexArray(cubeVAO);
        glActiveTexture(GL_TEXTURE0);
        glBindTexture(GL_TEXTURE_2D, cubeTexture);
        shader.setInt("useTex", 1);
        model = glm::translate(model, glm::vec3(-1.0f, 0.0f, -1.0f));
        shader.setMatrix("model", model);
        glDrawArrays(GL_TRIANGLES, 0, 36);

        model = glm::mat4(1.0f);
        model = glm::translate(model, glm::vec3(2.0f, 0.0f, 0.0f));
        shader.setMatrix("model", model);
        glDrawArrays(GL_TRIANGLES, 0, 36);

        glBindVertexArray(0);

        glBindVertexArray(planeVAO);
        glActiveTexture(GL_TEXTURE1);
        glBindTexture(GL_TEXTURE_2D, floorTexture);
        shader.setInt("useTex", 2);
        shader.setMatrix("model", glm::mat4(1.0f));
        glDrawArrays(GL_TRIANGLES, 0, 6);
        glBindVertexArray(0);

        glBindVertexArray(transparentVAO);
        glActiveTexture(GL_TEXTURE2);
        glBindTexture(GL_TEXTURE_2D, grassTexture);
        shader.setInt("useTex", 3);
        for (int i = 0; i < vegetation.size(); i++) {
            model = glm::mat4(1.0f);
            model = glm::translate(model, vegetation[i]);
            shader.setMatrix("model", model);
            shader.setMatrix("view", view);
            shader.setMatrix("project", project);
            glDrawArrays(GL_TRIANGLES, 0, 6);
        }
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
//fragmentShader
#version 330 core
in vec2 TexCoords;
out vec4 FragColor;
uniform sampler2D texture1;
uniform sampler2D texture2;
uniform sampler2D texture3;

uniform int useTex;
void main(){
    vec4 texColor;
        if(useTex==1){
        texColor=texture(texture1,TexCoords);
    }else if(useTex==2){
        texColor=texture(texture2,TexCoords);
    }else if(useTex==3){
        texColor=texture(texture3,TexCoords);
    }
    if(texColor.a<0.1){
        discard;
    }
    FragColor=texColor;
}
```
![BQACAgUAAyEGAASHRsPbAAEWK1FqP2x--a1FzSNttvBXIic8GHvbjQACqCQAAk05AVaXd1k6KExjBjwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWK1FqP2x--a1FzSNttvBXIic8GHvbjQACqCQAAk05AVaXd1k6KExjBjwE.png)
可以发现纹理顶部也出现了一些颜色，而这些区域原本应该完全透明。这是因为纹理的环绕模式（`wrap mode`）设置为`GL_REPEAT`，这会在纹理边缘，混合另一边的像素颜色，这不是我们想要的。所以需要为透明度纹理设置环绕模式为`GL_CLAMP_TO_EDGE`。
![BQACAgUAAyEGAASHRsPbAAEWK1JqP2yr6GxjfbxtTJ3Wnwv4BFJHSgACqSQAAk05AVbx3R6srDpaKTwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWK1JqP2yr6GxjfbxtTJ3Wnwv4BFJHSgACqSQAAk05AVbx3R6srDpaKTwE.png)

# example2: 透明度混合
使用一张半透明的纹理替换上边的草纹理，并开启透明度混合，设置混合函数（源因子和目标因子）。在片元着色器中，不再需要丢弃片元，直接输出采样到的纹理颜色，之后GPU会自动帮我们混合，然后输出。
![BQACAgUAAyEGAASHRsPbAAEWK1NqP2zONOWOwk-UxZIHVaFw87O5FgACqiQAAk05AVazV7_zAVwUczwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWK1NqP2zONOWOwk-UxZIHVaFw87O5FgACqiQAAk05AVazV7_zAVwUczwE.png)
![BQACAgUAAyEGAASHRsPbAAEWK1RqP2zkTaxuhO7U2wVm5bn5jA6SsAACqyQAAk05AVYYzjx5Ox-CgTwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWK1RqP2zkTaxuhO7U2wVm5bn5jA6SsAACqyQAAk05AVYYzjx5Ox-CgTwE.png)
你会发现，前边的窗户部分遮挡了后边的窗户，由于窗户是透明度，所以这不太对。这是因为写入深度缓冲时，透明片元和不透明片元会一同处理，一同写入深度缓冲，那么也会正常进行深度测试，前边的遮挡后边的。所以在渲染透明物体时，深度缓冲并不能起到很好的作用，甚至有些干扰了渲染。所以我们需要手动的、固定按照从后往前的顺序渲染这些透明物体，后面渲染的物体（视角上更靠前）会与前面渲染的物体（视角上更靠后）混合。而对于透明度测试，我们只是简单的丢弃片元，深度测试不会对它造成影响。
**从后往前渲染的实现是**：首先定义物体的远近关系，判断依据是物体到观察者（即摄像机）的距离，这可以通过计算物体指向摄像机的向量的长度得到；然后是对这些距离进行排序，可以借助`map`，它能够自动根据`key`的大小，把容器内的`value`按`key`从小到大的顺序排序，那么本案例中，`key`就是物体到摄像机的距离，`value`就是物体的位置；接着是从远到近的绘制，在渲染循环中，由于`map`是**从小（近）到大（远）**的排序，所以需要**逆向**遍历`map`，可以借助`map`的**逆向迭代器**`reverse_iterator`实现。
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

        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
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
    glEnable(GL_BLEND);
    glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);

    Shader shader("src/Shader/vertexShader.txt", "src/Shader/fragmentShader.txt");

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

    float transparentVertices[] = {
        0.0f,  0.5f,  0.0f,  0.0f,  1.0f,//左上
        0.0f, -0.5f,  0.0f,  0.0f,  0.0f,//左下
        1.0f, -0.5f,  0.0f,  1.0f,  0.0f,//右下

        0.0f,  0.5f,  0.0f,  0.0f,  1.0f,//左上
        1.0f, -0.5f,  0.0f,  1.0f,  0.0f,//右下
        1.0f,  0.5f,  0.0f,  1.0f,  1.0f//右上
    };

    vector<glm::vec3> windowQuad{
        glm::vec3(-1.5f, 0.0f, -0.48f),
        glm::vec3(1.5f, 0.0f, 0.51f),
        glm::vec3(0.0f, 0.0f, 0.7f),
        glm::vec3(-0.3f, 0.0f, -2.3f),
        glm::vec3(0.5f, 0.0f, -0.6f)
    };

    map<float, glm::vec3> sorted;
    //map会自动根据键值即这里的float进行从小到大的排序，那么以distance作为key，从后往前取map中的value，就能得到从远到近的quad的位置
    for (int i = 0; i < windowQuad.size(); i++) {
        float distance = glm::length(camera.Position - windowQuad[i]);
        sorted[distance] = windowQuad[i];
    }

    unsigned int cubeVAO, cubeVBO;
    glGenVertexArrays(1, &cubeVAO);
    glGenBuffers(1, &cubeVBO);

    glBindVertexArray(cubeVAO);
    glBindBuffer(GL_ARRAY_BUFFER, cubeVBO);
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
    glBindBuffer(GL_ARRAY_BUFFER, planeVBO);
    glBufferData(GL_ARRAY_BUFFER, sizeof(planeVertices), planeVertices, GL_STATIC_DRAW);

    glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 5 * sizeof(float), (void*)0);
    glEnableVertexAttribArray(0);

    glVertexAttribPointer(1, 2, GL_FLOAT, GL_FALSE, 5 * sizeof(float), (void*)(3 * sizeof(float)));
    glEnableVertexAttribArray(1);

    glBindVertexArray(0);

    unsigned int transparentVAO, transparentVBO;
    glGenVertexArrays(1, &transparentVAO);
    glGenBuffers(1, &transparentVBO);

    glBindVertexArray(transparentVAO);
    glBindBuffer(GL_ARRAY_BUFFER, transparentVBO);

    glBufferData(GL_ARRAY_BUFFER, sizeof(transparentVertices), transparentVertices, GL_STATIC_DRAW);
    
    glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 5 * sizeof(float), (void*)0);
    glEnableVertexAttribArray(0);
    glVertexAttribPointer(1, 2, GL_FLOAT, GL_FALSE, 5 * sizeof(float), (void*)(3 * sizeof(float)));
    glEnableVertexAttribArray(1);

    glBindVertexArray(0);

    unsigned int cubeTexture = loadTexture("resources/textures/marble.jpg");
    unsigned int floorTexture = loadTexture("resources/textures/metal.jpg");
    unsigned int transparentTexture = loadTexture("resources/textures/blending_transparent_window.png");

    shader.use();
    shader.setInt("texture1", 0);
    shader.setInt("texture2", 1);
    shader.setInt("texture3", 2);

    while (!glfwWindowShouldClose(window)) {
        float currentFrame = (float)glfwGetTime();
        deltaTime = currentFrame - lastFrame;
        lastFrame = currentFrame;

        processInput(window);

        glClearColor(0.1f, 0.1f, 0.1f, 1.0f);
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

        shader.use();
        glm::mat4 model = glm::mat4(1.0f);
        glm::mat4 view = camera.GetCameraView();
        glm::mat4 project = glm::perspective(glm::radians(camera.Zoom), (float)SCR_WIDTH / (float)SCR_HEIGHT, 0.1f, 100.0f);
        shader.setMatrix("view", view);
        shader.setMatrix("project", project);

        glBindVertexArray(cubeVAO);
        glActiveTexture(GL_TEXTURE0);
        glBindTexture(GL_TEXTURE_2D, cubeTexture);
        shader.setInt("useTex", 1);
        model = glm::translate(model, glm::vec3(-1.0f, 0.0f, -1.0f));
        shader.setMatrix("model", model);
        glDrawArrays(GL_TRIANGLES, 0, 36);

        model = glm::mat4(1.0f);
        model = glm::translate(model, glm::vec3(2.0f, 0.0f, 0.0f));
        shader.setMatrix("model", model);
        glDrawArrays(GL_TRIANGLES, 0, 36);

        glBindVertexArray(0);

        glBindVertexArray(planeVAO);
        glActiveTexture(GL_TEXTURE1);
        glBindTexture(GL_TEXTURE_2D, floorTexture);
        shader.setInt("useTex", 2);
        shader.setMatrix("model", glm::mat4(1.0f));
        glDrawArrays(GL_TRIANGLES, 0, 6);
        glBindVertexArray(0);

        glBindVertexArray(transparentVAO);
        glActiveTexture(GL_TEXTURE2);
        glBindTexture(GL_TEXTURE_2D, transparentTexture);
        shader.setInt("useTex", 3);
        for (map<float, glm::vec3>::reverse_iterator it = sorted.rbegin(); it != sorted.rend(); it++) {
            model = glm::mat4(1.0f);
            model = glm::translate(model, it->second);
            shader.setMatrix("model", model);
            shader.setMatrix("view", view);
            shader.setMatrix("project", project);
            glDrawArrays(GL_TRIANGLES, 0, 6);
        }
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
![BQACAgUAAyEGAASHRsPbAAEWK1tqP21I2FsXeK2gHNIRIjHp1AXKEgACsiQAAk05AVZ70fCqPpWMTTwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWK1tqP21I2FsXeK2gHNIRIjHp1AXKEgACsiQAAk05AVZ70fCqPpWMTTwE.png)
但是上面这种排序假设物体**各个部分都是相同的深度**，对于那些不同地方深度不一样的物体来说，这样的深度排序就是不正确的。
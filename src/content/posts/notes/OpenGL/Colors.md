---
title: Colors
published: 2026-06-27
description: 'Learn OpenGL 第二章第一节'
image: ''
tags: [OpenGL]
category: '学习笔记/OpenGL'
draft: false 
lang: 'zh'
---
# 光照颜色渲染原理
屏幕最终呈现的物体颜色、即人眼感知到的物体颜色，由**光源颜色 × 物体自身颜色** 计算得出。
## 物体颜色的物理含义
物体的固有色本质上代表物体对各类色光的**反射比例**：决定了物体对红、绿、蓝三色光源的吸收与反射程度。
## 颜色渲染规则
- 物体颜色固定时，修改**光源颜色**，可以直接改变物体最终反射呈现的颜色效果；
- 光源颜色固定时，修改**物体固有色**，可以改变物体对光线的反射比例，同样改变最终渲染颜色。
# 灯光与物体 VAO 分离原则
## 核心结论
**灯光立方体与场景物体立方体必须使用独立 VAO，允许共用同一个 VBO**。
## 不能共用 VAO 的原因
VAO 的核心作用是**存储顶点属性解析状态**（顶点数据的布局、偏移、步长、属性开关等）：
- **普通物体模型**：顶点数据包含**顶点位置、法线、纹理坐标**等多种属性，需要配置多组顶点属性解析规则；
- **灯光立方体模型**：仅需要展示几何形状，**只需要顶点位置属性**，不需要法线、纹理坐标等额外属性。
若两者共用同一个 VAO，灯光会强制继承物体的顶点属性配置，导致多余属性解析异常、渲染出错，因此必须分离 VAO，各自维护独立的顶点属性解析状态。
## 可以共用 VBO 的原因
VBO 仅负责存储原始顶点数据，不参与数据解析规则配置。
灯光与物体可共用同一 VBO 顶点数据源：灯光的 VAO 只会解析、读取数据中的**顶点位置部分**，忽略、屏蔽法线、纹理坐标等多余数据，实现资源复用，节省显存开销。

# example1: 搭建一个简单的光照场景
场景中包含一个立方体被照物体和一个立方体灯光。同时使用上一节创建的摄像机类来实现`FPS`风格的相机移动。
物体和灯光都是立方体，共享同一组顶点数据，因此共享同一个VBO。但由于之后为实现完整光照，物体可能增加更多的顶点属性如法线、纹理等，但对于灯来说，我们只需要位置就足够，所以之后会扩充顶点数组。为了使得灯和物体都能够正常从VBO中读取顶点位置数据，需要为二者定义不同的VAO（即不同的读取规则），对于物体来说，他能够“看到”VBO中所有的顶点属性；对于灯来说，它只能够“看到”其中的位置属性。通过改变步长和偏移两个参数值，能够跳过某些不需要读取的属性。
此外，物体的颜色（即物体反射出来，被人眼感知到的颜色）是物体自身颜色（每个分量分别对应物体对这个分量的颜色的反射率）和灯光颜色的乘积，而灯的颜色我们希望是保持白色不变的，那么就需要为二者分别定义片元着色器，根据不同的逻辑计算输出颜色。对于顶点着色器，二者可以共用。
```c
//main.cpp
#include <glad/glad.h>
#include <GLFW/glfw3.h>
#include<iostream>
#include <glm/glm.hpp>
#include <glm/gtc/matrix_transform.hpp>
#include <glm/gtc/type_ptr.hpp>

#include <myShader.h>
#include <myCamera.h>

using namespace std;

const unsigned int SCR_WIDTH = 800;
const unsigned int SCR_HEIGHT = 600;

Camera camera(glm::vec3(0.0f, 0.0f, 3.0f));
bool firstMove = true;
float lastX = SCR_WIDTH / 2.0f;
float lastY = SCR_HEIGHT / 2.0f;
float lastFrame = 0.0f, deltaTime = 0.0f;

glm::vec3 lightPos(1.2f, 1.0f, 2.0f);

void framebuffer_size_callback(GLFWwindow* window, int width, int height) {
        glViewport(0, 0, width, height);
}
void mouseMove_callback(GLFWwindow* window, double xpos, double ypos) {
    if (firstMove) {
        lastX = static_cast<float>(xpos);
        lastY = static_cast<float>(ypos);
        firstMove = false;
    }
    float xoffset = static_cast<float>(xpos) - lastX;
    float yoffset = lastY - static_cast<float>(ypos);
    lastX = static_cast<float>(xpos);
    lastY = static_cast<float>(ypos);
    camera.ProcessMouseMovement(xoffset, yoffset);
}
void mouse_scroll_callback(GLFWwindow* windwo, double xoffset, double yoffset) {
    camera.ProcessScroll(static_cast<float>(yoffset));
}
void processInput(GLFWwindow* window) {
        if (glfwGetKey(window, GLFW_KEY_ESCAPE) == GLFW_PRESS) {
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

int main() {
        glfwInit();
        glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 3);
        glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 3);
        glfwWindowHint(GLFW_OPENGL_PROFILE, GLFW_OPENGL_CORE_PROFILE);

        GLFWwindow* window = glfwCreateWindow(SCR_WIDTH, SCR_HEIGHT, "LearnOpenGL", NULL, NULL);
        if (window == NULL) {
                cout << "Failed to create window" << endl;
                glfwTerminate();
                return -1;
        }
        glfwMakeContextCurrent(window);
        glfwSetFramebufferSizeCallback(window, framebuffer_size_callback);
    glfwSetInputMode(window, GLFW_CURSOR, GLFW_CURSOR_DISABLED);
    glfwSetCursorPosCallback(window, mouseMove_callback);
    glfwSetScrollCallback(window, mouse_scroll_callback);

        if (!gladLoadGLLoader((GLADloadproc)glfwGetProcAddress)) {
                cout << "Failed to load GLAD" << endl;
                glfwTerminate();
                return -1;
        }
        glEnable(GL_DEPTH_TEST);

    float vertices[] = {
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

    unsigned int VBO, VAO;
    //处理被照物体的顶点属性
    glGenVertexArrays(1, &VAO);
    glGenBuffers(1, &VBO);
    glBindVertexArray(VAO);
    glBindBuffer(GL_ARRAY_BUFFER, VBO);
    glBufferData(GL_ARRAY_BUFFER, sizeof(vertices), vertices, GL_STATIC_DRAW);
    glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 3 * sizeof(float), (void*)0);
    glEnableVertexAttribArray(0);
    glBindVertexArray(0);

    //处理灯的顶点属性
    unsigned int lightVAO;
    glGenVertexArrays(1, &lightVAO);
    glBindVertexArray(lightVAO);
    //二者共用一份VBO，不需要再创建，只需绑定
    glBindBuffer(GL_ARRAY_BUFFER, VBO);//告诉lightVAO从哪里读取顶点数据
    //也不需要传递顶点数据，因为灯和被照物体共用一份顶点数据，已经在处理物体时传递过了
    //设置读取规则
    glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 3 * sizeof(float),(void*)0);
    glEnableVertexAttribArray(0);
    glBindVertexArray(0);

    //物体的着色器
        Shader ourShader("src/Shader/vertexShader.txt", "src/Shader/fragmentShader.txt");
    //光源的着色器
    //如果共用一个片元着色器，修改物体颜色将会修改光源颜色，这并不是我们想要的
    Shader lightShader("src/Shader/vertexShader.txt", "src/Shader/lightFragmentShader.txt");

        ourShader.use();
        //设置uniform变量值
    ourShader.setVec3("objectColor", glm::vec3(1.0f, 0.5f, 0.31f));
    ourShader.setVec3("lightColor", glm::vec3(1.0f, 1.0f, 1.0f));

        while (!glfwWindowShouldClose(window)) {
        float currentFrame = static_cast<float>(glfwGetTime());
        deltaTime = currentFrame - lastFrame;
        lastFrame = currentFrame;
                processInput(window);
                glClearColor(0.2f, 0.3f, 0.3f, 1.0f);
                glClear(GL_COLOR_BUFFER_BIT|GL_DEPTH_BUFFER_BIT);

        //绘制物体
        ourShader.use();
        glBindVertexArray(VAO);
        glm::mat4 model;
        ourShader.setMatrix("model", model);
        glm::mat4 view;
        view = camera.GetCameraView();
        ourShader.setMatrix("view", view);
        glm::mat4 project;
        project = glm::perspective(glm::radians(camera.Zoom), (float)SCR_WIDTH / (float)SCR_HEIGHT, 0.1f, 100.0f);
        ourShader.setMatrix("project", project);
        glDrawArrays(GL_TRIANGLES, 0, 36);

        //绘制灯
        lightShader.use();
        glBindVertexArray(lightVAO);
        model = glm::mat4();
        model = glm::translate(model, lightPos);
        model = glm::scale(model, glm::vec3(0.2f));
        lightShader.setMatrix("model", model);
        lightShader.setMatrix("view", view);
        lightShader.setMatrix("project", project);
        glDrawArrays(GL_TRIANGLES, 0, 36);

        glfwSwapBuffers(window);
        glfwPollEvents();
        }
    glDeleteVertexArrays(1, &VAO);
    glDeleteVertexArrays(1, &lightVAO);
    glDeleteBuffers(1, &VBO);
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
        gl_Position = project*view*model*vec4(aPos,1.0f);
}
```
```glsl
//fragmentShader
#version 330 core
out vec4 FragColor;

uniform vec3 objectColor;
uniform vec3 lightColor;
void main(){
        FragColor=vec4(lightColor*objectColor,1.0);
}
```
```glsl
//lightFragmentShader
#version 330 core
out vec4 FragColor;
void main(){
        FragColor=vec4(1.0);
}
```
---
title: Multiple Lights
published: 2026-06-27
description: 'Learn OpenGL 第二章第六节'
image: ''
tags: [OpenGL]
category: '学习笔记/OpenGL'
draft: false 
lang: 'zh'
---
# example1: 将三种光源的光照计算分别封装成函数，然后合并使用到一个场景中
在**片元着色器**中定义三个函数，分别计算**平行光、点光源和聚光灯的光照**，然后在`main`函数中调用合并到最后输出光照中。计算的逻辑和上一章实现的一样，就不再说明。特别的是，由于场景中有多个点光源，所以在片元着色器中定义了一个**点光源结构体数组**，每个元素都是一个**点光源结构体**。对于**光照计算函数**来说，它计算的是一个点光源的光照。而每个点光源的光照都需要叠加到最终的输出光照中，所以需要遍历数组。此外，在`main.cpp`主程序中，平行光和聚光灯不用绘制（实体），只需要传`uniform`属性；点光源需要绘制（实体），且要传`uniform`属性。对于点光源实体的绘制，定义了一个位置数组，作为每个光源的`model`矩阵的平移分量，循环绘制每一个点光源（实体）；对于点光源`uniform`属性的传递，因为要按`uniform`属性名传递，所以不能直接使用循环，而是需要拼接属性名，再传入；或者就直接一个个传入。
在编写过程中也出现了不少bug：1.片元着色器中的`void main`写成了`int main`；2.片元着色器中定义了结构体，但是没有声明结构体的`uniform`变量3.片元着色器中的`in`属性名和顶点着色器的`out`属性名不一致4.直接在字符串里写拼接`uniform`变量名
![BQACAgUAAyEGAASHRsPbAAEWKphqP1y86RkNk9YQwdOQd5_WFRt9agACpSMAAk05AVaJPFZ8LTFTFTwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWKphqP1y86RkNk9YQwdOQd5_WFRt9agACpSMAAk05AVaJPFZ8LTFTFTwE.png)
```c
//main.cpp
#define STB_IMAGE_IMPLEMENTATION
#include <glad/glad.h>
#include <GLFW/glfw3.h>
#include <stb_image.h>
#include <iostream>
#include <cstdio>
#include <glm/glm.hpp>
#include <glm/gtc/matrix_transform.hpp>
#include <glm/gtc/type_ptr.hpp>

#include <myShader.h>
#include <myCamera.h>

using namespace std;

const unsigned int SCR_WIDTH = 800;
const unsigned int SCR_HEIGHT = 600;
#define NR_POINT_LIGHTS 4

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
unsigned int loadTexture(const char* path) {
    unsigned int texture;
    glGenTextures(1, &texture);
    glBindTexture(GL_TEXTURE_2D, texture);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_REPEAT);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_REPEAT);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR_MIPMAP_LINEAR);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);

    int width, height, nrChannels;
    stbi_set_flip_vertically_on_load(true);
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
        // positions          // normals           // texture coords
        -0.5f, -0.5f, -0.5f,  0.0f,  0.0f, -1.0f,  0.0f, 0.0f,
         0.5f, -0.5f, -0.5f,  0.0f,  0.0f, -1.0f,  1.0f, 0.0f,
         0.5f,  0.5f, -0.5f,  0.0f,  0.0f, -1.0f,  1.0f, 1.0f,
         0.5f,  0.5f, -0.5f,  0.0f,  0.0f, -1.0f,  1.0f, 1.0f,
        -0.5f,  0.5f, -0.5f,  0.0f,  0.0f, -1.0f,  0.0f, 1.0f,
        -0.5f, -0.5f, -0.5f,  0.0f,  0.0f, -1.0f,  0.0f, 0.0f,

        -0.5f, -0.5f,  0.5f,  0.0f,  0.0f, 1.0f,   0.0f, 0.0f,
         0.5f, -0.5f,  0.5f,  0.0f,  0.0f, 1.0f,   1.0f, 0.0f,
         0.5f,  0.5f,  0.5f,  0.0f,  0.0f, 1.0f,   1.0f, 1.0f,
         0.5f,  0.5f,  0.5f,  0.0f,  0.0f, 1.0f,   1.0f, 1.0f,
        -0.5f,  0.5f,  0.5f,  0.0f,  0.0f, 1.0f,   0.0f, 1.0f,
        -0.5f, -0.5f,  0.5f,  0.0f,  0.0f, 1.0f,   0.0f, 0.0f,

        -0.5f,  0.5f,  0.5f, -1.0f,  0.0f,  0.0f,  1.0f, 0.0f,
        -0.5f,  0.5f, -0.5f, -1.0f,  0.0f,  0.0f,  1.0f, 1.0f,
        -0.5f, -0.5f, -0.5f, -1.0f,  0.0f,  0.0f,  0.0f, 1.0f,
        -0.5f, -0.5f, -0.5f, -1.0f,  0.0f,  0.0f,  0.0f, 1.0f,
        -0.5f, -0.5f,  0.5f, -1.0f,  0.0f,  0.0f,  0.0f, 0.0f,
        -0.5f,  0.5f,  0.5f, -1.0f,  0.0f,  0.0f,  1.0f, 0.0f,

         0.5f,  0.5f,  0.5f,  1.0f,  0.0f,  0.0f,  1.0f, 0.0f,
         0.5f,  0.5f, -0.5f,  1.0f,  0.0f,  0.0f,  1.0f, 1.0f,
         0.5f, -0.5f, -0.5f,  1.0f,  0.0f,  0.0f,  0.0f, 1.0f,
         0.5f, -0.5f, -0.5f,  1.0f,  0.0f,  0.0f,  0.0f, 1.0f,
         0.5f, -0.5f,  0.5f,  1.0f,  0.0f,  0.0f,  0.0f, 0.0f,
         0.5f,  0.5f,  0.5f,  1.0f,  0.0f,  0.0f,  1.0f, 0.0f,

        -0.5f, -0.5f, -0.5f,  0.0f, -1.0f,  0.0f,  0.0f, 1.0f,
         0.5f, -0.5f, -0.5f,  0.0f, -1.0f,  0.0f,  1.0f, 1.0f,
         0.5f, -0.5f,  0.5f,  0.0f, -1.0f,  0.0f,  1.0f, 0.0f,
         0.5f, -0.5f,  0.5f,  0.0f, -1.0f,  0.0f,  1.0f, 0.0f,
        -0.5f, -0.5f,  0.5f,  0.0f, -1.0f,  0.0f,  0.0f, 0.0f,
        -0.5f, -0.5f, -0.5f,  0.0f, -1.0f,  0.0f,  0.0f, 1.0f,

        -0.5f,  0.5f, -0.5f,  0.0f,  1.0f,  0.0f,  0.0f, 1.0f,
         0.5f,  0.5f, -0.5f,  0.0f,  1.0f,  0.0f,  1.0f, 1.0f,
         0.5f,  0.5f,  0.5f,  0.0f,  1.0f,  0.0f,  1.0f, 0.0f,
         0.5f,  0.5f,  0.5f,  0.0f,  1.0f,  0.0f,  1.0f, 0.0f,
        -0.5f,  0.5f,  0.5f,  0.0f,  1.0f,  0.0f,  0.0f, 0.0f,
        -0.5f,  0.5f, -0.5f,  0.0f,  1.0f,  0.0f,  0.0f, 1.0f
    };

    glm::vec3 cubePositions[] = {
        glm::vec3(0.0f,  0.0f,  0.0f),
        glm::vec3(2.0f,  5.0f, -15.0f),
        glm::vec3(-1.5f, -2.2f, -2.5f),
        glm::vec3(-3.8f, -2.0f, -12.3f),
        glm::vec3(2.4f, -0.4f, -3.5f),
        glm::vec3(-1.7f,  3.0f, -7.5f),
        glm::vec3(1.3f, -2.0f, -2.5f),
        glm::vec3(1.5f,  2.0f, -2.5f),
        glm::vec3(1.5f,  0.2f, -1.5f),
        glm::vec3(-1.3f,  1.0f, -1.5f)
    };

    glm::vec3 pointLightPositions[] = {
        glm::vec3(0.7f,  0.2f,  2.0f),
        glm::vec3(2.3f, -3.3f, -4.0f),
        glm::vec3(-4.0f,  2.0f, -12.0f),
        glm::vec3(0.0f,  0.0f, -3.0f)
    };

    glEnable(GL_DEPTH_TEST);

    unsigned int VBO, VAO;
    //处理被照物体的顶点属性
    glGenVertexArrays(1, &VAO);
    glGenBuffers(1, &VBO);
    glBindVertexArray(VAO);
    glBindBuffer(GL_ARRAY_BUFFER, VBO);
    glBufferData(GL_ARRAY_BUFFER, sizeof(vertices), vertices, GL_STATIC_DRAW);
    glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 8 * sizeof(float), (void*)0);
    glEnableVertexAttribArray(0);
    glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, 8 * sizeof(float), (void*)(3 * sizeof(float)));
    glEnableVertexAttribArray(1);
    glVertexAttribPointer(2, 2, GL_FLOAT, GL_FALSE, 8 * sizeof(float), (void*)(6 * sizeof(float)));
    glEnableVertexAttribArray(2);
    glBindVertexArray(0);

    //处理灯的顶点属性
    unsigned int lightVAO;
    glGenVertexArrays(1, &lightVAO);
    glBindVertexArray(lightVAO);
    //二者共用一份VBO，不需要再创建，只需绑定
    glBindBuffer(GL_ARRAY_BUFFER, VBO);//告诉lightVAO从哪里读取顶点数据
    //也不需要传递顶点数据，因为灯和被照物体共用一份顶点数据，已经在处理物体时传递过了
    //设置读取规则
    glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 8 * sizeof(float),(void*)0);
    glEnableVertexAttribArray(0);
    glBindVertexArray(0);

    unsigned int diffuseMap = loadTexture("resources/lighting_maps/container2.png");
    unsigned int specularMap = loadTexture("resources/lighting_maps/container2_specular.png");
    
    //物体的着色器
        Shader ourShader("src/Shader/vertexShader.txt", "src/Shader/fragmentShader.txt");
    //光源的着色器
    //如果共用一个片元着色器，修改物体颜色将会修改光源颜色，这并不是我们想要的
    Shader lightShader("src/Shader/vertexShader.txt", "src/Shader/lightFragmentShader.txt");

        ourShader.use();
        //设置物体运行时不需要改变的uniform变量值
    ourShader.setInt("material.diffuse", 0);
    ourShader.setInt("material.specular", 1);
    ourShader.setFloat("material.shininess", 32.0f);

    //设置平行光光照属性
    ourShader.setVec3("dirLight.direction", glm::vec3(-0.2f,-1.0f,-0.3f));
    ourShader.setVec3("dirLight.ambient", glm::vec3(0.05f));
    ourShader.setVec3("dirLight.diffuse", glm::vec3(0.4f));
    ourShader.setVec3("dirLight.specular", glm::vec3(0.5f));
    //设置点光源光照属性
    /*for (int i = 0; i < NR_POINT_LIGHTS; i++) {
        ourShader.setVec3("pointLights[i].position", pointLightPositions[i]);
        ourShader.setFloat("pointLights[i].constant", 1.0f);
        ourShader.setFloat("pointLights[i].linear", 0.09f);
        ourShader.setFloat("pointLights[i].quadratic", 0.032f);
        ourShader.setVec3("pointLights[i].ambient", glm::vec3(0.05f));
        ourShader.setVec3("pointLights[i].diffuse", glm::vec3(0.8f));
        ourShader.setVec3("pointLights[i].specular", glm::vec3(1.0f));
    }*///上面这种写法是错误的，C++不会把循环变量i填入字符串中，而是会把整个带i的字符串当作一个整体
    //所以要么一个个设置，要么使用sprintf拼接字符串
    char uniformName[128];
    for (int i = 0; i < NR_POINT_LIGHTS; i++) {
        sprintf_s(uniformName, "pointLights[%d].position", i);//这里是为了设置灯光结构体中变量的值，渲染循环中使用是为了设置绘制灯光立方体的model矩阵，二者缺一不可
        ourShader.setVec3(uniformName, pointLightPositions[i]);

        sprintf_s(uniformName, "pointLights[%d].constant", i);
        ourShader.setFloat(uniformName, 1.0f);

        sprintf_s(uniformName, "pointLights[%d].linear", i);
        ourShader.setFloat(uniformName, 0.09f);

        sprintf_s(uniformName, "pointLights[%d].quadratic", i);
        ourShader.setFloat(uniformName, 0.032f);

        sprintf_s(uniformName, "pointLights[%d].ambient", i);
        ourShader.setVec3(uniformName, glm::vec3(0.05f));

        sprintf_s(uniformName, "pointLights[%d].diffuse", i);
        ourShader.setVec3(uniformName, glm::vec3(0.8f));

        sprintf_s(uniformName, "pointLights[%d].specular", i);
        ourShader.setVec3(uniformName, glm::vec3(1.0f));
    }
    //设置聚光灯光照属性
    ourShader.setFloat("spotLight.cutOff", glm::cos(glm::radians(12.5f)));
    ourShader.setFloat("spotLight.outerCutOff", glm::cos(glm::radians(15.0f)));
    ourShader.setFloat("spotLight.constant", 1.0f);
    ourShader.setFloat("spotLight.linear", 0.09f);
    ourShader.setFloat("spotLight.quadratic", 0.032f);
    ourShader.setVec3("spotLight.ambient", glm::vec3(0.0f));
    ourShader.setVec3("spotLight.diffuse", glm::vec3(1.0f));
    ourShader.setVec3("spotLight.specular", glm::vec3(1.0f));

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
        
        //传递物体运行时需要更新的uniform变量
        ourShader.setVec3("viewPos", camera.Position);
        //传递运行时需要更新的灯光变量
        ourShader.setVec3("spotLight.position", camera.Position);
        ourShader.setVec3("spotLight.direction", camera.Front);

        //绘制贴图
        glActiveTexture(GL_TEXTURE0);
        glBindTexture(GL_TEXTURE_2D, diffuseMap);
        glActiveTexture(GL_TEXTURE1);
        glBindTexture(GL_TEXTURE_2D, specularMap);

        for (unsigned int i = 0; i < 10; i++) {
            model = glm::mat4(1.0);
            model = glm::translate(model, cubePositions[i]);
            float angle = 20.0f * i;
            model = glm::rotate(model, glm::radians(angle), glm::vec3(1.0f, 0.3f, 0.5f));
            ourShader.setMatrix("model", model);
            glDrawArrays(GL_TRIANGLES, 0, 36);
        }

        //绘制点光源
        lightShader.use();
        glBindVertexArray(lightVAO);
        for (int i = 0; i < NR_POINT_LIGHTS; i++) {
            glm::mat4 model;
            model = glm::translate(model, pointLightPositions[i]);
            model = glm::scale(model, glm::vec3(0.2f));
            lightShader.setMatrix("model", model);
            lightShader.setMatrix("view", view);
            lightShader.setMatrix("project", project);
            glDrawArrays(GL_TRIANGLES, 0, 36);
        }
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
layout (location = 1) in vec3 aNormal;
layout (location = 2) in vec2 aTexcoords;

out vec3 worldPos;
out vec3 Normal;
out vec2 Texcoords;

uniform mat4 model;
uniform mat4 view;
uniform mat4 project;
void main(){
        gl_Position=project*view*model*vec4(aPos,1.0);
        worldPos=vec3(model*vec4(aPos,1.0));
        Normal = mat3(transpose(inverse(model)))*aNormal;
        Texcoords=aTexcoords;
}
```
```glsl
//fragmentShader
#version 330 core
in vec3 Normal;
in vec2 Texcoords;
in vec3 worldPos;
out vec4 FragColor;
struct Material{
        sampler2D diffuse;
        sampler2D specular;
        float shininess;
};
struct DirLight{
        vec3 direction;

        vec3 ambient;
        vec3 diffuse;
        vec3 specular;
};
struct PointLight{
        vec3 position;

        float constant;
        float linear;
        float quadratic;

        vec3 ambient;
        vec3 diffuse;
        vec3 specular;
};
struct SpotLight{
        vec3 position;
        vec3 direction;
        float cutOff;
        float outerCutOff;

        float constant;
        float linear;
        float quadratic;

        vec3 ambient;
        vec3 diffuse;
        vec3 specular;
};
uniform Material material;
uniform DirLight dirLight;
#define NR_POINT_LIGHTS 4
uniform PointLight pointLights[NR_POINT_LIGHTS];//定义了结构体数组，每个元素都是一个结构体
uniform SpotLight spotLight;
uniform vec3 viewPos;
vec3 CalcDirLight(DirLight light,vec3 worldNormal,vec3 worldViewDir){
        vec3 worldLightDir=normalize(-light.direction);
        float diff=max(dot(worldNormal,worldLightDir),0.0f);

        vec4 texColor=texture(material.diffuse,Texcoords);
        vec3 ambient=light.ambient*texColor.rgb;
        vec3 diffuse=light.diffuse*diff*texColor.rgb;
        vec3 reflectDir=reflect(-worldLightDir,worldNormal);
        float spec=pow(max(dot(worldViewDir,reflectDir),0.0f),material.shininess);
        vec3 specular=light.specular*spec*texture(material.specular,Texcoords).rgb;

        return (ambient+diffuse+specular);
}
vec3 CalcPointLight(PointLight light,vec3 worldNormal,vec3 worldViewDir){
        vec3 worldLightDir=normalize(light.position-worldPos);
        vec4 texColor=texture(material.diffuse,Texcoords);

        float diff=max(dot(worldNormal,worldLightDir),0.0f);
        vec3 ambient=light.ambient*texColor.rgb;
        vec3 diffuse=light.diffuse*diff*texColor.rgb;
        vec3 reflectDir=reflect(-worldLightDir,worldNormal);
        float spec=pow(max(dot(worldViewDir,reflectDir),0.0f),material.shininess);
        vec3 specular=light.specular*spec*texture(material.specular,Texcoords).rgb;

        float distance=length(light.position-worldPos);
        float atten=(1.0) / (light.constant+light.linear*distance+light.quadratic*distance*distance);

        return (ambient+diffuse+specular)*atten;
}
vec3 CalcSpotLight(SpotLight light,vec3 worldNormal,vec3 worldViewDir){
        vec3 worldLightDir=normalize(light.position-worldPos);
        vec4 texColor=texture(material.diffuse,Texcoords);
        vec4 specularColor=texture(material.specular,Texcoords);

        float theta=dot(worldLightDir,normalize(-light.direction));//不需要max(,0),而且时取light.direction的反
        float intensity=clamp((theta-light.outerCutOff)/(light.cutOff-light.outerCutOff),0.0,1.0);

        vec3 ambient=light.ambient*texColor.rgb;
        float diff=max(dot(worldLightDir,worldNormal),0.0f);
        vec3 diffuse=light.diffuse*diff*texColor.rgb;
        vec3 reflectDir=reflect(-worldLightDir,worldNormal);
        float spec=pow(max(dot(worldViewDir,reflectDir),0.0f),material.shininess);
        vec3 specular=light.specular*spec*specularColor.rgb;

        float distance=length(light.position-worldPos);
        float atten=(1.0)/(light.constant+light.linear*distance+light.quadratic*distance*distance);

        return (ambient+(diffuse+specular)*intensity)*atten;
}
void main(){
        vec3 worldNormal=normalize(Normal);
        vec3 worldViewDir=normalize(viewPos-worldPos);

        vec3 result=CalcDirLight(dirLight,worldNormal,worldViewDir);
        for(int i=0;i<NR_POINT_LIGHTS;i++){
                result+=CalcPointLight(pointLights[i],worldNormal,worldViewDir);
        }
        result+=CalcSpotLight(spotLight,worldNormal,worldViewDir);
        FragColor=vec4(result,1.0);
}
```

# homework1
你能通过调节光照属性变量，（大概地）重现最后一张图片上不同的氛围吗？
*思路*：通过修改清屏颜色(`glClearColor`)、光照属性变量（各个光源的`ambient`、`diffuse`和`specular`），实现不同风格的场景。
如沙漠：
![BQACAgUAAyEGAASHRsPbAAEWKpxqP11dUsfMjzWILSwsHjfIIe1o4QACqSMAAk05AVY7dIrmGF7iCDwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWKpxqP11dUsfMjzWILSwsHjfIIe1o4QACqSMAAk05AVY7dIrmGF7iCDwE.png)
```c
//main.cpp
//设置了点光源的光照颜色，既用于实现点光源的ambient/diffuse和specular，也用于在场景中绘制点光源（立方体实体）时的颜色
glm::vec3 pointLightColors[] = {
    glm::vec3(1.0f,0.6f,0.0f),
    glm::vec3(1.0f,0.0f,0.0f),
    glm::vec3(1.0f,1.0f,0.0f),
    glm::vec3(0.2f,0.2f,1.0f)
};
//设置平行光的光照颜色
ourShader.setVec3("dirLight.ambient", glm::vec3(0.3f,0.24f,0.14f));
ourShader.setVec3("dirLight.diffuse", glm::vec3(0.7f,0.42f,0.26f));
ourShader.setVec3("dirLight.specular", glm::vec3(0.5f));
//设置点光源的光照颜色（重点是设置ambient/diffuse和specular）
char uniformName[128];
for (int i = 0; i < NR_POINT_LIGHTS; i++) {
    sprintf_s(uniformName, "pointLights[%d].position", i);//这里是为了设置灯光结构体中变量的值，渲染循环中使用是为了设置绘制灯光立方体的model矩阵，二者缺一不可
    ourShader.setVec3(uniformName, pointLightPositions[i]);

    sprintf_s(uniformName, "pointLights[%d].constant", i);
    ourShader.setFloat(uniformName, 1.0f);

    sprintf_s(uniformName, "pointLights[%d].linear", i);
    ourShader.setFloat(uniformName, 0.09f);

    sprintf_s(uniformName, "pointLights[%d].quadratic", i);
    ourShader.setFloat(uniformName, 0.032f);

    sprintf_s(uniformName, "pointLights[%d].ambient", i);
    ourShader.setVec3(uniformName, glm::vec3(pointLightColors[i].x*0.1,pointLightColors[i].y*0.1,pointLightColors[i].z*0.1));

    sprintf_s(uniformName, "pointLights[%d].diffuse", i);
    ourShader.setVec3(uniformName, glm::vec3(pointLightColors[i].x,pointLightColors[i].y,pointLightColors[i].z));

    sprintf_s(uniformName, "pointLights[%d].specular", i);
    ourShader.setVec3(uniformName, glm::vec3(pointLightColors[i].x, pointLightColors[i].y, pointLightColors[i].z));
}
//设置聚光灯的光照属性
ourShader.setVec3("spotLight.ambient", glm::vec3(0.0f));
ourShader.setVec3("spotLight.diffuse", glm::vec3(0.8f, 0.8f, 0.0f));
ourShader.setVec3("spotLight.specular", glm::vec3(0.8f,0.8f,0.0f));
//清屏颜色
glClearColor(0.75f, 0.52f, 0.3f, 1.0f);
```
为了使得场景中的点光源实体也带上我们设置的`pointLightColors`的颜色，那么需要在`lightShader`的**片元着色器**中增加`lightColor`属性，并在`cpp`中绘制光源立方体时传递。
```glsl
//lightFragmentShader
#version 330 core
out vec4 FragColor;
uniform vec3 lightColor;
void main(){
        FragColor=vec4(lightColor,1.0);
}
```
```c
//main.cpp
//绘制点光源
lightShader.use();
glBindVertexArray(lightVAO);
for (int i = 0; i < NR_POINT_LIGHTS; i++) {
    glm::mat4 model;
    model = glm::translate(model, pointLightPositions[i]);
    model = glm::scale(model, glm::vec3(0.2f));
    lightShader.setMatrix("model", model);
    lightShader.setMatrix("view", view);
    lightShader.setMatrix("project", project);
    lightShader.setVec3("lightColor", glm::vec3(pointLightColors[i].x, pointLightColors[i].y, pointLightColors[i].z));
    glDrawArrays(GL_TRIANGLES, 0, 36);
}
```
如工厂：
![BQACAgUAAyEGAASHRsPbAAEWKp5qP12awT43YgtQ6_LSXKlJzv2X_AACqyMAAk05AVaI7qiXkff3TDwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWKp5qP12awT43YgtQ6_LSXKlJzv2X_AACqyMAAk05AVaI7qiXkff3TDwE.png)
```c
//main.cpp
//所有光源颜色的设置都是比较暗且偏蓝色
//点光源颜色
glm::vec3 pointLightColors[] = {
    glm::vec3(0.2f,0.2f,0.6f),
    glm::vec3(0.3f,0.3f,0.7f),
    glm::vec3(0.0f,0.0f,0.3f),
    glm::vec3(0.4f,0.4f,0.4f)
};
//平行光
ourShader.setVec3("dirLight.ambient", glm::vec3(0.05f,0.05f,0.1f));
ourShader.setVec3("dirLight.diffuse", glm::vec3(0.2f,0.2f,0.7f));
ourShader.setVec3("dirLight.specular", glm::vec3(0.7f));
//点光源ambient/diffuse/specular的设置代码同沙漠
//聚光灯
ourShader.setVec3("spotLight.ambient", glm::vec3(0.0f));
ourShader.setVec3("spotLight.diffuse", glm::vec3(1.0f));
ourShader.setVec3("spotLight.specular", glm::vec3(1.0f));
//清屏颜色
glClearColor(0.1f, 0.1f, 0.1f, 1.0f);
//绘制点光源的代码以及顶点着色器的代码同沙漠
```
如恐怖：
![BQACAgUAAyEGAASHRsPbAAEWKp9qP13MBL-udTz8kMAcYAifPp_VoAACrSMAAk05AVb1-6XCxLkUKzwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWKp9qP13MBL-udTz8kMAcYAifPp_VoAACrSMAAk05AVb1-6XCxLkUKzwE.png)
```c
//main.cpp
//整体色调较黑暗，且几乎没有环境光
//点光源颜色
glm::vec3 pointLightColors[] = {
    glm::vec3(0.1f,0.1f,0.1f),
    glm::vec3(0.1f,0.1f,0.1f),
    glm::vec3(0.1f,0.1f,0.1f),
    glm::vec3(0.3f,0.1f,0.1f)
};
//平行光
ourShader.setVec3("dirLight.ambient", glm::vec3(0.0f));
ourShader.setVec3("dirLight.diffuse", glm::vec3(0.05f));
ourShader.setVec3("dirLight.specular", glm::vec3(0.2f));
//点光源，调整了衰减效果，使得光照传播距离更短了
char uniformName[128];
for (int i = 0; i < NR_POINT_LIGHTS; i++) {
    sprintf_s(uniformName, "pointLights[%d].position", i);//这里是为了设置灯光结构体中变量的值，渲染循环中使用是为了设置绘制灯光立方体的model矩阵，二者缺一不可
    ourShader.setVec3(uniformName, pointLightPositions[i]);

    sprintf_s(uniformName, "pointLights[%d].constant", i);
    ourShader.setFloat(uniformName, 1.0f);

    sprintf_s(uniformName, "pointLights[%d].linear", i);
    ourShader.setFloat(uniformName, 0.14f);

    sprintf_s(uniformName, "pointLights[%d].quadratic", i);
    ourShader.setFloat(uniformName, 0.07f);

    sprintf_s(uniformName, "pointLights[%d].ambient", i);
    ourShader.setVec3(uniformName, glm::vec3(pointLightColors[i].x*0.1,pointLightColors[i].y*0.1,pointLightColors[i].z*0.1));

    sprintf_s(uniformName, "pointLights[%d].diffuse", i);
    ourShader.setVec3(uniformName, glm::vec3(pointLightColors[i].x,pointLightColors[i].y,pointLightColors[i].z));

    sprintf_s(uniformName, "pointLights[%d].specular", i);
    ourShader.setVec3(uniformName, glm::vec3(pointLightColors[i].x, pointLightColors[i].y, pointLightColors[i].z));
}
//聚光灯，调整了灯光的边缘衰减以及三个分量的颜色
ourShader.setFloat("spotLight.cutOff", glm::cos(glm::radians(10.0f)));
ourShader.setFloat("spotLight.outerCutOff", glm::cos(glm::radians(15.0f)));
ourShader.setFloat("spotLight.constant", 1.0f);
ourShader.setFloat("spotLight.linear", 0.09f);
ourShader.setFloat("spotLight.quadratic", 0.032f);
ourShader.setVec3("spotLight.ambient", glm::vec3(0.0f));
ourShader.setVec3("spotLight.diffuse", glm::vec3(1.0f));
ourShader.setVec3("spotLight.specular", glm::vec3(1.0f));
//绘制点光源实体的代码和顶点着色器的代码与之前的案例一致
//清屏颜色
glClearColor(0.0f, 0.0f, 0.0f, 1.0f);
```
如生物实验室：
![BQACAgUAAyEGAASHRsPbAAEWKqBqP137raTr3rH0QjqU_X4U2ChO4gACriMAAk05AVZbiKg_xHpyYTwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWKqBqP137raTr3rH0QjqU_X4U2ChO4gACriMAAk05AVZbiKg_xHpyYTwE.png)
```c
//main.cpp
glm::vec3 pointLightColors[] = {
    glm::vec3(0.4f,0.7f,0.1f),
    glm::vec3(0.4f,0.7f,0.1f),
    glm::vec3(0.4f,0.7f,0.1f),
    glm::vec3(0.4f,0.7f,0.1f)
};
ourShader.setVec3("dirLight.ambient", glm::vec3(0.5f));
ourShader.setVec3("dirLight.diffuse", glm::vec3(1.0f));
ourShader.setVec3("dirLight.specular", glm::vec3(1.0f));
//点光源光照，修改了衰减系数，使得光源能够到达更远的地方
char uniformName[128];
for (int i = 0; i < NR_POINT_LIGHTS; i++) {
    sprintf_s(uniformName, "pointLights[%d].position", i);//这里是为了设置灯光结构体中变量的值，渲染循环中使用是为了设置绘制灯光立方体的model矩阵，二者缺一不可
    ourShader.setVec3(uniformName, pointLightPositions[i]);

    sprintf_s(uniformName, "pointLights[%d].constant", i);
    ourShader.setFloat(uniformName, 1.0f);

    sprintf_s(uniformName, "pointLights[%d].linear", i);
    ourShader.setFloat(uniformName, 0.07f);

    sprintf_s(uniformName, "pointLights[%d].quadratic", i);
    ourShader.setFloat(uniformName, 0.017f);

    sprintf_s(uniformName, "pointLights[%d].ambient", i);
    ourShader.setVec3(uniformName, glm::vec3(pointLightColors[i].x*0.1,pointLightColors[i].y*0.1,pointLightColors[i].z*0.1));

    sprintf_s(uniformName, "pointLights[%d].diffuse", i);
    ourShader.setVec3(uniformName, glm::vec3(pointLightColors[i].x,pointLightColors[i].y,pointLightColors[i].z));

    sprintf_s(uniformName, "pointLights[%d].specular", i);
    ourShader.setVec3(uniformName, glm::vec3(pointLightColors[i].x, pointLightColors[i].y, pointLightColors[i].z));
}
//修改了控制边缘衰减的内切光角和外切光角，过渡区域更短
ourShader.setFloat("spotLight.cutOff", glm::cos(glm::radians(7.0f)));
ourShader.setFloat("spotLight.outerCutOff", glm::cos(glm::radians(10.0f)));
ourShader.setFloat("spotLight.constant", 1.0f);
ourShader.setFloat("spotLight.linear", 0.07f);
ourShader.setFloat("spotLight.quadratic", 0.017f);
ourShader.setVec3("spotLight.ambient", glm::vec3(0.0f));
ourShader.setVec3("spotLight.diffuse", glm::vec3(0.0f,1.0f,0.0f));
ourShader.setVec3("spotLight.specular", glm::vec3(0.0f, 1.0f, 0.0f));
```

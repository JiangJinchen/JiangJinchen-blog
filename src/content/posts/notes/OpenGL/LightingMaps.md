---
title: Lighting Maps
published: 2026-06-27
description: 'Learn OpenGL 第二章第四节'
image: ''
tags: [OpenGL]
category: '学习笔记/OpenGL'
draft: false 
lang: 'zh'
---
# 光照贴图（Lighting Maps）引入原因
基础材质系统存在局限性：单个物体仅对应一套材质参数（固定材质颜色、光源属性、高光参数），整个物体只能呈现统一的光照视觉效果，无法模拟现实物体局部材质不同、光影效果不同的真实表现。
*光照贴图解决方案*：通过**贴图纹理**采样，让物体不同位置的像素/片元读取不同的光照参数，实现同一物体多材质、局部差异化光影效果，大幅提升渲染真实度。
# 光照贴图与 sampler2D 原理
- 光照贴图本质属于纹理资源，存储在`sampler2D`中，`sampler2D` 对应显卡纹理单元编号，每个纹理单元绑定一张贴图。
- `sampler2D` 是 GPU 硬件底层资源，无法在着色器中随意实例化，必须由 CPU 通过 `uniform` 变量传递 至 GPU。
- 贴图属于全局渲染资源，不属于单个顶点、单个片元私有数据，因此 `sampler2D` 变量必须定义为 `uniform` 类型。
# 环境光贴图规则
在真实渲染中，**物体的环境光颜色几乎与漫反射颜色保持一致**，因此可以直接移除材质结构体中独立的环境光颜色定义，复用漫反射贴图数据，精简材质参数。
若需要单独保留环境光颜色：环境光对物体所有像素的光照强度均匀统一，而贴图是逐像素不一样，所以无法通过贴图采样获取环境光，必须手动单独定义固定颜色。
# 镜面反射贴图制作原理
可通过 Photoshop、GIMP 等图像工具，基于漫反射纹理快速制作镜面反射纹理：
1. 裁剪漫反射贴图，去除不需要镜面高光反射的区域；
2. 将图像转为黑白灰度图；
3. 调整亮度、对比度，控制高光强度范围。
核心原理：镜面贴图存储的是**高光强度数值**，而非颜色。镜面高光的最终色彩由光源颜色决定，即使贴图存储彩色信息，也无法得到真实的高光效果，因此统一使用黑白灰度图存储强度。
# 放射光贴图（自发光贴图）
放射光贴图用于实现**物体自发光**效果，可以精准控制物体任意片元的发光区域、发光强度，脱离光源照射限制，让物体自身产生光照颜色。
# 光照方向校正规则
- **光源原始方向**：由光源位置指向片元位置。
- **光照计算所需方向**：由片元位置指向光源位置。
- 光照计算前必须对方向向量取反，否则光照计算结果完全错误。
# 方向光与点光源区分规则
向量无位置属性、只有方向，点坐标包含位置属性，可通过齐次坐标 **w 分量** 快速区分：
- **w = 0**：纯方向向量，代表**方向光**（无具体光源位置，只有光照方向）。
- **w = 1**：空间位置坐标，代表**点光源**（有具体世界空间位置）。
# 聚光灯原理与判定规则
## 聚光灯核心参数
聚光灯由三个核心参数定义：**世界空间光源位置、直射方向向量、切光角**（光照锥形边界与直射方向的夹角）。
## 片元光照范围判定
1. 计算光源指向当前片元的光照方向向量；
2. 将光照方向与聚光灯直射方向做**点积运算**，得到夹角余弦值；
3. 对比余弦值与切光角余弦值：若数值更大，代表片元处于光照锥形范围外，不接收光照。
## 手电筒（相机聚光灯）特殊实现
手电筒是绑定相机的特殊聚光灯：
- 光源位置 = 相机世界位置；
- 光照直射方向 = 相机视线朝向；
- 光照位置与朝向会随相机移动、视角转动实时更新。
# 聚光灯双层锥体衰减机制
点光源仅存在**距离衰减**（距离越远光照越弱）；聚光灯额外拥有**锥形范围衰减**，通过内外双层锥体实现平滑光影过渡：
- **内锥体内部**：光照强度 = 1.0，无衰减，光照效果最强；
- **外锥体外部**：光照强度 = 0.0，完全无光照；
- **内外锥体之间**：光照强度线性插值过渡，避免光照边界生硬锯齿，实现柔和光影渐变。

# example1: 使用漫反射贴图
贴图的加载和使用与纹理类似：图片内容都存在**纹理单元**里，并使用一个`sampler2D`的变量指向这个纹理单元。`sampler2D`类型的变量都需要定义为`uniform`全局变量，并在C++代码中传递。都使用`texture`函数采样得到像素值。
![BQACAgUAAyEGAASHRsPbAAEWKm5qP1jJGdts88fEvF8VGgAB8LA3GKEAAnEjAAJNOQFWcBE0f8vgciA8BA.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWKm5qP1jJGdts88fEvF8VGgAB8LA3GKEAAnEjAAJNOQFWcBE0f8vgciA8BA.png)
```glsl
//vertexShader
//新增了纹理坐标的顶点着色器
#version 330 core
layout (location = 0) in vec3 aPos;
layout (location = 1) in vec3 aNormal;
layout (location = 2) in vec2 aTexcoords;

out vec3 worldPos;
out vec3 normal;
out vec2 Texcoords;

uniform mat4 model;
uniform mat4 view;
uniform mat4 project;
void main(){
        gl_Position=project*view*model*vec4(aPos,1.0);
        worldPos=vec3(model*vec4(aPos,1.0));
        normal = mat3(transpose(inverse(model)))*aNormal;
        Texcoords=aTexcoords;
}
```
```glsl
//fragmentShader
//材质结构体中的diffuse改为sampler2D类型，删除单独定义的环境光颜色
//漫反射颜色和环境光颜色都从漫反射贴图中采样
#version 330 core
struct Material{
        sampler2D diffuse;
        vec3 specular;
        float shininess;
};
struct Light{
        vec3 lightPos;
        vec3 ambient;
        vec3 diffuse;
        vec3 specular;
};
in vec3 worldPos;
in vec3 normal;
in vec2 Texcoords;
uniform Material material;
uniform Light light;
uniform vec3 viewPos;
out vec4 FragColor;
void main(){
        vec3 ambient = light.ambient*texture(material.diffuse,Texcoords).rgb;
        
        vec3 worldNormal=normalize(normal);
        vec3 worldLightDir=normalize(light.lightPos-worldPos);
        float diff=max(dot(worldNormal,worldLightDir),0.0);
        vec3 diffuse=diff*texture(material.diffuse,Texcoords).rgb*light.diffuse;

        vec3 worldViewDir=normalize(viewPos-worldPos);
        vec3 reflectDir=reflect(-worldLightDir,worldNormal);
        float spec=pow(max(dot(worldViewDir,reflectDir),0.0),material.shininess);
        vec3 specular=spec*material.specular*light.specular;

        FragColor = vec4(ambient+diffuse+specular,1.0);
}
```
```c
//main.cpp
#define STB_IMAGE_IMPLEMENTATION
#include <glad/glad.h>
#include <GLFW/glfw3.h>
#include <stb_image.h>
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
    unsigned char* data = stbi_load("resources/lighting_maps/container2.png", &width, &height, &nrChannels, 0);
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

    unsigned int texture = loadTexture("resources/lighting_maps/container.png");

    //物体的着色器
        Shader ourShader("src/Shader/vertexShader.txt", "src/Shader/fragmentShader.txt");
    //光源的着色器
    //如果共用一个片元着色器，修改物体颜色将会修改光源颜色，这并不是我们想要的
    Shader lightShader("src/Shader/vertexShader.txt", "src/Shader/lightFragmentShader.txt");

        ourShader.use();
        //设置物体运行时不需要改变的uniform变量值
    ourShader.setInt("material.diffuse", 0);
    ourShader.setVec3("material.specular", glm::vec3(0.5));
    ourShader.setFloat("material.shininess", 64.0f);

    ourShader.setVec3("light.ambient", glm::vec3(0.2f));
    ourShader.setVec3("light.diffuse", glm::vec3(0.5f));
    ourShader.setVec3("light.specular", glm::vec3(1.0f));

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
        ourShader.setVec3("light.lightPos", lightPos);

        //绘制贴图
        glActiveTexture(GL_TEXTURE0);
        glBindTexture(GL_TEXTURE_2D, texture);//设置绘制当前物体所需的纹理

        glDrawArrays(GL_TRIANGLES, 0, 36);

        //绘制灯
        lightShader.use();
        glBindVertexArray(lightVAO);
        model = glm::mat4();
        model = glm::translate(model, lightPos);//把光源变换到新的位置。看样子我好像在旋转光源，但实际上是计算光源新的位置，然后把光源平移到这个圆形轨道上
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

# example2: 使用镜面反射贴图
根据上面运行的结果，发现整个箱子的高光都比较强，但是实际上，箱子中间的木头部分的高光应该非常弱，金属边框的高光应该比较强。那么我们又遇到了使用漫反射贴图之前的问题，我们希望物体不同地方的高光强度不一样。所以我们引进了**镜面反射贴图**，他的加载和使用的逻辑和漫反射贴图一致，在片元着色器计算镜面反射光照中，从镜面反射贴图采样得到**镜面反射强度**，然后计算镜面反射。
![BQACAgUAAyEGAASHRsPbAAEWKn1qP1kjiirtewvlDp4dJPVX4TDQSAACgSMAAk05AVZ56zOX7YiLtjwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWKn1qP1kjiirtewvlDp4dJPVX4TDQSAACgSMAAk05AVZ56zOX7YiLtjwE.png)
```c
//main.cpp
#define STB_IMAGE_IMPLEMENTATION
#include <glad/glad.h>
#include <GLFW/glfw3.h>
#include <stb_image.h>
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
    ourShader.setFloat("material.shininess", 64.0f);

    ourShader.setVec3("light.ambient", glm::vec3(0.2f));
    ourShader.setVec3("light.diffuse", glm::vec3(0.5f));
    ourShader.setVec3("light.specular", glm::vec3(1.0f));

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
        ourShader.setVec3("light.lightPos", lightPos);

        //绘制贴图
        glActiveTexture(GL_TEXTURE0);
        glBindTexture(GL_TEXTURE_2D, diffuseMap);//设置绘制当前物体所需的纹理
        glActiveTexture(GL_TEXTURE1);
        glBindTexture(GL_TEXTURE_2D, specularMap);

        glDrawArrays(GL_TRIANGLES, 0, 36);

        //绘制灯
        lightShader.use();
        glBindVertexArray(lightVAO);
        model = glm::mat4();
        model = glm::translate(model, lightPos);//把光源变换到新的位置。看样子我好像在旋转光源，但实际上是计算光源新的位置，然后把光源平移到这个圆形轨道上
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
//fragmentShader
#version 330 core
struct Material{
        sampler2D diffuse;
        sampler2D specular;
        float shininess;
};
struct Light{
        vec3 lightPos;
        vec3 ambient;
        vec3 diffuse;
        vec3 specular;
};
in vec3 worldPos;
in vec3 normal;
in vec2 Texcoords;
uniform Material material;
uniform Light light;
uniform vec3 viewPos;
out vec4 FragColor;
void main(){
        vec3 ambient = light.ambient*texture(material.diffuse,Texcoords).rgb;
        
        vec3 worldNormal=normalize(normal);
        vec3 worldLightDir=normalize(light.lightPos-worldPos);
        float diff=max(dot(worldNormal,worldLightDir),0.0);
        vec3 diffuse=diff*texture(material.diffuse,Texcoords).rgb*light.diffuse;

        vec3 worldViewDir=normalize(viewPos-worldPos);
        vec3 reflectDir=reflect(-worldLightDir,worldNormal);
        float spec=pow(max(dot(worldViewDir,reflectDir),0.0),material.shininess);
        vec3 specular=spec*texture(material.specular,Texcoords).rgb*light.specular;

        FragColor = vec4(ambient+diffuse+specular,1.0);
}
```

# homework1
调整光源的环境光、漫反射和镜面光向量，看看它们如何影响箱子的视觉输出。
*测试*：增大或减小环境光，整个箱子各个地方都均匀的增大/减小亮度；增大或减小漫反射，亮度增加/减小没有环境光明显，且明暗对比比改变环境光更为明显；增大或减小镜面光，高光的亮度和范围都增大/减小。

# homework2
尝试在片段着色器中反转镜面光贴图的颜色值，让木头显示镜面高光而钢制边缘不反光（由于钢制边缘中有一些裂缝，边缘仍会显示一些镜面高光，虽然强度会小很多）。
*思路*：在片元着色器中对采样结果的颜色值进行`1-`反转（`texture`输出的颜色值在`[0-1]`之间，反转则是`1-`）
![BQACAgUAAyEGAASHRsPbAAEWKoBqP1l7afbTkxzR9NQVftZvRgKdVgAChiMAAk05AVa_HIb0oDlK1jwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWKoBqP1l7afbTkxzR9NQVftZvRgKdVgAChiMAAk05AVa_HIb0oDlK1jwE.png)
```glsl
//fragmentShader
vec3 specular=spec*(vec3(1.0)-texture(material.specular,Texcoords).rgb)*light.specular;
```
箱子中部很亮，金属边框几乎没有高光。

# homework3
使用漫反射贴图创建一个彩色而不是黑白的镜面光贴图，看看结果看起来并不是那么真实了。如果你不会生成的话，可以使用这张彩色的镜面光贴图。
*思路*：直接替换镜面反射贴图。
![BQACAgUAAyEGAASHRsPbAAEWKoFqP1mwNN0dV71ixqCM3eR2EuzGMwAChyMAAk05AVZp8Z-r9lu9XzwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWKoFqP1mwNN0dV71ixqCM3eR2EuzGMwAChyMAAk05AVZp8Z-r9lu9XzwE.png)

# homework4
添加一个叫做放射光贴图(Emission Map)的东西，它是一个储存了每个片段的发光值(Emission Value)的贴图。发光值是一个包含（假设）光源的物体发光(Emit)时可能显现的颜色，这样的话物体就能够忽略光照条件进行发光(Glow)。游戏中某个物体在发光的时候，你通常看到的就是放射光贴图（比如 机器人的眼，或是箱子上的灯带）。将这个纹理（作者为 creativesam）作为放射光贴图添加到箱子上，产生这些字母都在发光的效果.
*思路*：新增自发光贴图的加载、使用逻辑，然后在片元着色器中，新增自发光分量，从自发光贴图中采样。
![BQACAgUAAyEGAASHRsPbAAEWKoJqP1oGT0KhL9EhMJ9y7zUG2R4ycAACiyMAAk05AVbjflOPiN-7AAE8BA.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWKoJqP1oGT0KhL9EhMJ9y7zUG2R4ycAACiyMAAk05AVbjflOPiN-7AAE8BA.png)
```c
//main.cpp
unsigned int diffuseMap = loadTexture("resources/lighting_maps/container2.png");
unsigned int specularMap = loadTexture("resources/lighting_maps/container2_specular.png");
unsigned int emissiveMap = loadTexture("resources/lighting_maps/matrix.jpg");

//物体的着色器
Shader ourShader("src/Shader/vertexShader.txt", "src/Shader/fragmentShader.txt");
//光源的着色器
//如果共用一个片元着色器，修改物体颜色将会修改光源颜色，这并不是我们想要的
Shader lightShader("src/Shader/vertexShader.txt", "src/Shader/lightFragmentShader.txt");

ourShader.use();
//设置物体运行时不需要改变的uniform变量值
ourShader.setInt("material.diffuse", 0);
ourShader.setInt("material.specular", 1);
ourShader.setFloat("material.shininess", 64.0f);
ourShader.setInt("material.emissive", 2);

ourShader.setVec3("light.ambient", glm::vec3(0.2f));
ourShader.setVec3("light.diffuse", glm::vec3(0.5f));
ourShader.setVec3("light.specular", glm::vec3(1.0f));

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
    ourShader.setVec3("light.lightPos", lightPos);

    //绘制贴图
    glActiveTexture(GL_TEXTURE0);
    glBindTexture(GL_TEXTURE_2D, diffuseMap);//设置绘制当前物体所需的纹理
    glActiveTexture(GL_TEXTURE1);
    glBindTexture(GL_TEXTURE_2D, specularMap);
    glActiveTexture(GL_TEXTURE2);
    glBindTexture(GL_TEXTURE_2D, emissiveMap);

    glDrawArrays(GL_TRIANGLES, 0, 36);

    //绘制灯
    lightShader.use();
    glBindVertexArray(lightVAO);
    model = glm::mat4();
    model = glm::translate(model, lightPos);//把光源变换到新的位置。看样子我好像在旋转光源，但实际上是计算光源新的位置，然后把光源平移到这个圆形轨道上
    model = glm::scale(model, glm::vec3(0.2f));
    lightShader.setMatrix("model", model);
    lightShader.setMatrix("view", view);
    lightShader.setMatrix("project", project);
    glDrawArrays(GL_TRIANGLES, 0, 36);

    glfwSwapBuffers(window);
    glfwPollEvents();
}
```
```glsl
//fragmentShader
#version 330 core
struct Material{
        sampler2D diffuse;
        sampler2D specular;
        sampler2D emissive;
        float shininess;
};
struct Light{
        vec3 lightPos;
        vec3 ambient;
        vec3 diffuse;
        vec3 specular;
};
in vec3 worldPos;
in vec3 normal;
in vec2 Texcoords;
uniform Material material;
uniform Light light;
uniform vec3 viewPos;
out vec4 FragColor;
void main(){
        vec3 ambient = light.ambient*texture(material.diffuse,Texcoords).rgb;
        
        vec3 worldNormal=normalize(normal);
        vec3 worldLightDir=normalize(light.lightPos-worldPos);
        float diff=max(dot(worldNormal,worldLightDir),0.0);
        vec3 diffuse=diff*texture(material.diffuse,Texcoords).rgb*light.diffuse;

        vec3 worldViewDir=normalize(viewPos-worldPos);
        vec3 reflectDir=reflect(-worldLightDir,worldNormal);
        float spec=pow(max(dot(worldViewDir,reflectDir),0.0),material.shininess);
        vec3 specular=spec*texture(material.specular,Texcoords).rgb*light.specular;

        vec3 emissive=texture(material.emissive,Texcoords).rgb;
        FragColor = vec4(ambient+diffuse+specular+emissive,1.0);
}
```


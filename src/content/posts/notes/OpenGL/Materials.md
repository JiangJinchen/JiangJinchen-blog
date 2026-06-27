---
title: Materials
published: 2026-06-27
description: 'Learn OpenGL 第二章第三节'
image: ''
tags: [OpenGL]
category: '学习笔记/OpenGL'
draft: false 
lang: 'zh'
---
# 散射和高光范围的关系
散射是指光线射入物体内部，经过内部散射后再从物体表面射出，**入射点与出射点通常不是同一点**。
- **散射强**：大量光线进入物体内部并从不同位置射出，光线分布更分散，最终表现为**高光范围更大、更柔和**。
- **散射弱**：光线极少进入物体内部，大部分光线直接在物体表面镜面反射，入射点与出射点基本一致，最终表现为**高光范围更小、更集中**。
# Phong 材质的四大核心属性
Phong 光照模型通过四组参数完整定义一个物体的**材质特性**，分别控制环境光、漫反射、镜面高光表现与高光散射范围：
- **ambient（环境光颜色）**：定义物体在环境光照射下反射的颜色，一般与物体固有色保持一致。
- **diffuse（漫反射颜色）**：定义物体在漫反射光照下呈现的固有色，是物体最主要的显色来源。
- **specular（镜面高光颜色）**：定义物体表面镜面高光区域的反射颜色。
- **shininess（高光幂次）**：控制镜面高光的散射半径，数值越大，高光范围越小、越锐利；数值越小，高光越宽泛、柔和。
# 材质系统引入前后的光照计算区别
## 未引入材质系统
环境光、漫反射、镜面光三个分量的基础颜色**仅为光源颜色**，仅有强度系数差异，不包含物体本身颜色信息。
因此最终输出颜色需要**光照计算结果 × 物体固有色**。
## 引入材质系统后
材质的 ambient、diffuse、specular 向量本身已经携带并定义了物体的反射色彩，已经包含物体固有色信息。
因此最终颜色直接**三分量光照结果叠加求和，不再额外乘以物体颜色**。
# 光照分量强度系数的真实作用
基础 Phong 公式中，光照分量强度仅由计算系数决定。若环境光系数为 1，会导致环境光对画面颜色影响过大，不符合真实物理光照效果。
因此真实渲染优化方案：**为环境光、漫反射、镜面光分别配置独立强度系数（向量）**，替代单纯的光源颜色，用来控制各分量对最终颜色的贡献权重。
取值经验规则：
- **环境光**：设置较低强度，避免画面过曝、泛白。
- **漫反射**：设置为物体真实固有色，主导物体视觉表现。
- **镜面高光**：通常设为满强度 vec3(1.0)，保证高光亮度正常。
补充：光照颜色向量既可以代表反射颜色，也可以代表对应光照分量的强度权重。

# example1: 实现一个简单的材质系统（适配phong模型）
在phong模型中，一个物体受到的光照包含三个部分，分别是环境光、漫反射和镜面反射。上面的实现中，三种分量的颜色都是**光源颜色**，只是**强度**略有不同。现在我们**直接指定三种分量的颜色**，并抽离成一个**材质结构体**，通过改变**三分量的颜色以及反光度**，可以实现多样的材质效果。
![BQACAgUAAyEGAASHRsPbAAEWKlJqP1XrilcnYFhrZTlxr6zky_y2OQACUSMAAk05AVYX1j96mdoiITwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWKlJqP1XrilcnYFhrZTlxr6zky_y2OQACUSMAAk05AVYX1j96mdoiITwE.png)
```glsl
//vertexShader
#version 330 core
layout (location = 0) in vec3 aPos;
layout (location = 1) in vec3 aNormal;

out vec3 worldPos;
out vec3 normal;

uniform mat4 model;
uniform mat4 view;
uniform mat4 project;
void main(){
        gl_Position=project*view*model*vec4(aPos,1.0);
        worldPos=vec3(model*vec4(aPos,1.0));
        normal = mat3(transpose(inverse(model)))*aNormal;
}
```
```glsl
//fragmentShader
#version 330 core
struct Material{
        vec3 ambient;
        vec3 diffuse;
        vec3 specular;
        float shininess;
};
in vec3 worldPos;
in vec3 normal;
uniform Material material;
uniform vec3 lightPos;
uniform vec3 viewPos;
uniform vec3 lightColor;
out vec4 FragColor;
void main(){
        vec3 ambient = lightColor*material.ambient;
        
        vec3 worldNormal=normalize(normal);
        vec3 worldLightDir=normalize(lightPos-worldPos);
        float diff=max(dot(worldNormal,worldLightDir),0.0);
        vec3 diffuse=diff*material.diffuse*lightColor;

        vec3 worldViewDir=normalize(viewPos-worldPos);
        vec3 reflectDir=reflect(-worldLightDir,worldNormal);
        float spec=pow(max(dot(worldViewDir,reflectDir),0.0),material.shininess);
        vec3 specular=spec*material.specular*lightColor;

        FragColor = vec4(ambient+diffuse+specular,1.0);
}
```
```c
//main.cpp
Shader lightShader("src/Shader/vertexShader.txt", "src/Shader/lightFragmentShader.txt");

ourShader.use();
//设置uniform变量值
ourShader.setVec3("objectColor", glm::vec3(1.0f, 0.5f, 0.31f));
ourShader.setVec3("lightColor", glm::vec3(1.0f, 1.0f, 1.0f));

ourShader.setVec3("material.ambient", glm::vec3(1.0f, 0.5f, 0.31f));
ourShader.setVec3("material.diffuse", glm::vec3(1.0f, 0.5f, 0.31f));
ourShader.setVec3("material.specular", glm::vec3(0.5f, 0.5f, 0.5f));
ourShader.setFloat("material.shininess", 32.0f);

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
    ourShader.setVec3("lightPos", lightPos);//把新光源的位置传递给物体

    glm::mat4 model;
    ourShader.setMatrix("model", model);
    glm::mat4 view;
    view = camera.GetCameraView();
    ourShader.setMatrix("view", view);
    glm::mat4 project;
    project = glm::perspective(glm::radians(camera.Zoom), (float)SCR_WIDTH / (float)SCR_HEIGHT, 0.1f, 100.0f);
    ourShader.setMatrix("project", project);
    ourShader.setVec3("viewPos", camera.Position);//运行后，相机会移动，视角也会随之移动，也就是说视角是变化的，那么设置viewPos的语句就应该写在循环内
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
现在我们发现，物体似乎太亮了。原因在于，环境光、漫反射光以及镜面反射光，都是乘以**完完全全、一整份**光源颜色，所以他们对每个光源都是**全力反射**的，场景中只有一份光源，但是却反射出了三份光，所以物体看起来偏亮。解决思路就是给每个分量**分一个比例**，这个比例表示该分量对于光源的**反射强度**。

# example2: 抽离出光源结构体
对每个分量，使用一个向量控制这个分量在最终颜色中的比例。这个vec3向量是颜色和强度的二合一（`light.ambient=lightColor*ambientStrength`）。
![BQACAgUAAyEGAASHRsPbAAEWKlxqP1Zc6dFoBoyj0skdjadAnFm8ygACXCMAAk05AVZmuXQVr-V6ujwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWKlxqP1Zc6dFoBoyj0skdjadAnFm8ygACXCMAAk05AVZmuXQVr-V6ujwE.png)
```glsl
//fragmentShader
#version 330 core
struct Material{
        //编码了物体颜色
        vec3 ambient;//物体本身对环境光的反射率
        vec3 diffuse;//物体本身对漫反射光的反射率
        vec3 specular;//物体本身的高光颜色
        float shininess;
};
struct Light{
        //编码了灯光颜色
        vec3 lightPos;
        vec3 ambient;//环境光的强度和颜色
        vec3 diffuse;//漫反射光的强度和颜色
        vec3 specular;//高光的强度和颜色
};
//物体最终颜色=系数*物体颜色*光源颜色
in vec3 worldPos;
in vec3 normal;
uniform Material material;
uniform Light light;
uniform vec3 viewPos;
out vec4 FragColor;
void main(){
        vec3 ambient = light.ambient*material.ambient;
        
        vec3 worldNormal=normalize(normal);
        vec3 worldLightDir=normalize(light.lightPos-worldPos);
        float diff=max(dot(worldNormal,worldLightDir),0.0);
        vec3 diffuse=diff*material.diffuse*light.diffuse;

        vec3 worldViewDir=normalize(viewPos-worldPos);
        vec3 reflectDir=reflect(-worldLightDir,worldNormal);
        float spec=pow(max(dot(worldViewDir,reflectDir),0.0),material.shininess);
        vec3 specular=spec*material.specular*light.specular;

        FragColor = vec4(ambient+diffuse+specular,1.0);
}
```
```c
//main.cpp
ourShader.setVec3("light.ambient", glm::vec3(0.2f, 0.2f, 0.2f));
ourShader.setVec3("light.diffuse", glm::vec3(0.5f, 0.5f, 0.5f));
ourShader.setVec3("light.specular", glm::vec3(1.0f, 1.0f, 1.0f));

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
    ourShader.setVec3("light.lightPos", lightPos);//把新光源的位置传递给物体

    glm::mat4 model;
    ourShader.setMatrix("model", model);
    glm::mat4 view;
    view = camera.GetCameraView();
    ourShader.setMatrix("view", view);
    glm::mat4 project;
    project = glm::perspective(glm::radians(camera.Zoom), (float)SCR_WIDTH / (float)SCR_HEIGHT, 0.1f, 100.0f);
    ourShader.setMatrix("project", project);
    ourShader.setVec3("viewPos", camera.Position);//运行后，相机会移动，视角也会随之移动，也就是说视角是变化的，那么设置viewPos的语句就应该写在循环内
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

# example3: 让光源颜色不断变化
在渲染循环中使用`sin`函数，并使用`glfwGetTime()`获取**运行时间**作为**自变量**，计算`lightColor`三分量。然后赋值给`diffuseColor`和`ambientColor`，让场景中的光源颜色不断变化，观察物体表面颜色的变化。
物体表面颜色随着光源颜色的变化而变化，这是因为物体的`漫反射颜色=光源颜色*漫反射率`，漫反射率决定了物体对光源颜色中RGB三分量的反射比例，而反射出来的光被人眼感知，认为是物体的颜色。
```c
//main.cpp
//物体的着色器
Shader ourShader("src/Shader/vertexShader.txt", "src/Shader/fragmentShader.txt");
//光源的着色器
//如果共用一个片元着色器，修改物体颜色将会修改光源颜色，这并不是我们想要的
Shader lightShader("src/Shader/vertexShader.txt", "src/Shader/lightFragmentShader.txt");

ourShader.use();
//设置uniform变量值
ourShader.setVec3("material.ambient", glm::vec3(1.0f, 0.5f, 0.31f));
ourShader.setVec3("material.diffuse", glm::vec3(1.0f, 0.5f, 0.31f));
ourShader.setVec3("material.specular", glm::vec3(0.5f, 0.5f, 0.5f));
ourShader.setFloat("material.shininess", 32.0f);

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

    glm::vec3 lightColor;
    lightColor.x = static_cast<float>(sin(glfwGetTime() * 2.0));//计算光源颜色时需要用到运行时间，那么计算光源颜色的逻辑就必须写在渲染循环内部
    lightColor.y = static_cast<float>(sin(glfwGetTime() * 0.7));
    lightColor.z = static_cast<float>(sin(glfwGetTime() * 1.3));//让光源颜色的RGB分量以不同的速度变化，产生多样的颜色组合。如果是同步变化，则只能是从黑到白的过渡

    glm::vec3 diffuseColor = lightColor * glm::vec3(0.5f);//直接把lightColor作为漫反射光会太亮，乘以0.5压低亮度
    glm::vec3 ambientColor = diffuseColor * glm::vec3(0.2f);//环境光通常来自漫反射光的多次反弹，所以由diffuseColor计算，且环境光通常比较暗，所以需要进一步压低亮度
    ourShader.setVec3("light.ambient", ambientColor);
    ourShader.setVec3("light.diffuse", diffuseColor);//使用新计算出来的漫反射和环境光赋值光照结构体的相关变量
    ourShader.setVec3("light.specular", glm::vec3(1.0f, 1.0f, 1.0f));//高光保持全白、最大亮度
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

# homework
你能像教程一开始那样，通过定义相应的材质来模拟现实世界的物体吗？注意材质表格中的环境光值与漫反射值不一样，它们没有考虑光照的强度。要想正确地设置它们的值，你需要将所有的光照强度都设置为vec3(1.0)，这样才能得到一致的输出。
*思路*：材质表格中的各个字段设置的应该是`Material`结构体内的对应字段，而非`Light`结构体。此外，根据题目说明，材质表中的值没有考虑光照强度，也就是所有光照强度都是默认的1，即需要把`light.ambient/light.diffuse/light.specular`都设置为`vec3(1.0)`。
![BQACAgUAAyEGAASHRsPbAAEWKmFqP1bukPX8TqWwVD9MolwPuv6xnAACYiMAAk05AVa1exn8j1BSGzwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWKmFqP1bukPX8TqWwVD9MolwPuv6xnAACYiMAAk05AVa1exn8j1BSGzwE.png)
```c
//main.cpp
ourShader.setVec3("material.ambient", glm::vec3(0.0f, 0.1f, 0.06f));
ourShader.setVec3("material.diffuse", glm::vec3(0.0f, 0.50980392f, 0.50980392f));
ourShader.setVec3("material.specular", glm::vec3(0.50196078f, 0.50196078f, 0.50196078f));
ourShader.setFloat("material.shininess", 0.25f * 128.0);
//因为以上材质参数在运行时不需要改变，所以可以写在渲染循环外面
```
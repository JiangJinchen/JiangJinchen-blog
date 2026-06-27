---
title: Basic Lighting
published: 2026-06-27
description: 'Learn OpenGL 第二章第二节'
image: ''
tags: [OpenGL]
category: '学习笔记/OpenGL'
draft: false 
lang: 'zh'
---
# Gouraud着色原理
在**顶点着色器**中实现 Phong 光照模型，光照计算的单位为**每一个顶点**，该实现方式被称为**Gouraud 着色**。
# 着色渲染流程
仅对模型各个顶点进行光照颜色计算，得出每个顶点的最终光照颜色；模型内部所有片段的颜色，由相邻顶点的颜色通过GPU插值生成，无需单独计算片段光照。
# 优缺点对比
## 缺点：渲染效果较差
光照颜色仅在顶点处计算，片段颜色依靠插值近似得到，无法精准还原精细光影过渡，高光、明暗细节表现不足，整体渲染效果逊色于片段级光照计算。
## 优点：渲染性能更高
模型顶点数量远少于屏幕像素（片段）数量，大幅减少了光照计算次数，有效降低GPU运算开销，渲染速度更快、性能开销更低。

# example1: 实现简单的Phong光照模型
Phong光照模型包含**环境光、漫反射光和镜面反射光**三个部分。
在简化实现中，对于**环境光**，定义一个环境光强度，乘以光源颜色，得到环境光颜色（颜色和光源颜色一致，只是亮度更暗，完全可以定义一个新的不同于光源的环境光颜色，就不用使用强度系数了）。
![BQACAgUAAyEGAASHRsPbAAEWKgNqP0fYtZB93tZpn1KhQEdRk7iLUwACySIAAk05AVa73b5Gp5Tx7zwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWKgNqP0fYtZB93tZpn1KhQEdRk7iLUwACySIAAk05AVa73b5Gp5Tx7zwE.png)
```glsl
//fragmentShader
#version 330 core
out vec4 FragColor;

uniform vec3 objectColor;
uniform vec3 lightColor;
void main(){
        float ambientStrength=0.1f;//在0.1的环境光强度下，物体变得非常暗
        vec3 ambient = ambientStrength * lightColor;
        vec3 result = objectColor * ambient;
        FragColor = vec4(result,1.0);
}
```
对于**漫反射**，计算它需要片元的法向量和光源方向向量。对于*法向量*，片元的法向量是由顶点法向量插值而来，所以首先要获得顶点法向量。而顶点法向量是垂直于顶点表面的法向量，由于顶点没有表面，所以利用它周围的顶点和它一起构成平面，再利用叉乘计算这个面的法向量作为顶点法向量。但对于简单几何体，更简便的方法是在建模时把顶点法向量数据存储到每个顶点中，即直接在顶点数组`vertices`中定义。
这样顶点数组增加了一个新的顶点属性，需要同步修改物体VAO中读取顶点属性的规则。同时，由于不希望光源也读取到法线，所以也要修改光源VAO中的顶点读取规则中的步长，使之跳过法线属性。然后，需要在顶点着色器中新增一个输入属性，传递给物体的片元着色器（因为计算光照是在片元着色器）。同步修改物体的片元着色器的输入属性，使之能够接收这个变量。
对于*光源方向向量*，它是由片段位置和光源位置计算得到的。对于光源位置，可以在片元着色器中定义一个`uniform`属性，并在C++代码中渲染循环外部设置变量值。对于片段位置，可以视作顶点位置插值得到，而计算光照需要在世界空间下，所以需要在顶点着色器中使用`model`矩阵变换物体空间的顶点位置，传递给片元着色器。
```glsl
//vertexShader
#version 330 core
layout (location = 0) in vec3 aPos;
layout (location = 1) in vec3 aNormal;//直接从vertices数组中读取的顶点法线数据，那么它是模型空间下的

out vec3 Normal;
out vec3 FragPos;

uniform mat4 model;
uniform mat4 view;
uniform mat4 project;
void main(){
        gl_Position = project*view*model*vec4(aPos,1.0f);
        Normal=aNormal;//直接传出，那么传入片元着色器的法线也是模型空间下的
        FragPos=vec3(model*vec4(aPos,1.0f));
}
```
接下来就是计算**漫反射**，使用光照方向向量和法向量的点乘，同时需要确保二者都是单位向量。
将漫反射叠加到之前的环境光照中，共同作为物体受到的光照的一部分。
![BQACAgUAAyEGAASHRsPbAAEWKgpqP0hbvzz9JwEiSSLMm9mFTfcKYgAC0CIAAk05AVYSLy9Geh_cSDwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWKgpqP0hbvzz9JwEiSSLMm9mFTfcKYgAC0CIAAk05AVYSLy9Geh_cSDwE.png)
```glsl
//fragmentShader
#version 330 core
in vec3 Normal;
in vec3 FragPos;
out vec4 FragColor;

uniform vec3 lightPos;
uniform vec3 objectColor;
uniform vec3 lightColor;
void main(){
        float ambientStrength=0.1f;
        vec3 ambient = ambientStrength * lightColor;

        vec3 norm = normalize(Normal);//直接接收，那么计算漫反射时的法线是模型空间下的
        vec3 lightDir = normalize(lightPos-FragPos);//计算漫反射需要的光照方向向量是从片元指向光源
        float diff = max(dot(norm,lightDir),0.0f);
        vec3 diffuse = diff * lightColor;
        vec3 result = objectColor * (ambient + diffuse);
        FragColor = vec4(result,1.0);
}
```
可以看到**背离光源**的区域很暗，因为法向量和光照向量夹角大于90°，点乘结果小于0，钳制到0，则**没有漫反射**，**全是环境光**。
![BQACAgUAAyEGAASHRsPbAAEWKg1qP0ieixshu6CnV0J57SHS9czvhgAC1CIAAk05AVZgRPIFFAZY1jwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWKg1qP0ieixshu6CnV0J57SHS9czvhgAC1CIAAk05AVZgRPIFFAZY1jwE.png)
在上面的`Shader`代码中，我们直接把**模型的法线信息**传给了**顶点着色器**，又**不做任何变换的**传给了**片元着色器**。这意味着在**片元着色器**计算光照时，使用的是**模型空间**的法线信息。严格上说，这是不对的，必须统一到**世界坐标系下**。所以对**顶点着色器**进行修改，将法线变换到**世界空间**，再传给**片元着色器**。
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
        gl_Position = project*view*model*vec4(aPos,1.0f);
        Normal=vec3(model*vec4(aNormal,0.0f));
        FragPos=vec3(model*vec4(aPos,1.0f));
}
```
尽管这样改正之后，渲染出的效果并没有什么不同。让我们关注上面**顶点着色器**中对**法线**的**变换矩阵**，它和**模型顶点**的变换矩阵是一样的。考虑`model`包含**非线性缩放**，此时变换后的法线**不再垂直于**模型表面，那么光照效果就会出错（尽管我尝试设置了各种非线性缩放，发现光照效果并没有什么奇怪的地方，可能是因为模型不够复杂）。所以不能直接使用**顶点变换矩阵变换法线**，而是应该使用**顶点变换矩阵的逆矩阵的转置矩阵**。
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
        gl_Position = project*view*model*vec4(aPos,1.0f);
        Normal=mat3(transpose(inverse(model)))*aNormal;
        FragPos=vec3(model*vec4(aPos,1.0f));
}
```
但是，在**着色器中计算矩阵的逆**是开销非常大且昂贵的操作，所以最好的做法是**预计算**，然后使用**uniform变量**`normalMatrix`**传入**。
对于**镜面反射**，计算它需要光源方向向量、法向量以及视线方向。镜面反射效果强烈依赖视角方向，当视角方向与反射方向相近时，可以看到明显的高光效果。而反射方向由入射方向（光源方向向量的反方向，由光源指向片元）和法向量计算。而视线方向由片元指向观察位置，实际上，观察位置就是相机的位置（观察者就是相机，我们借助相机看到整个场景），所以在片元着色器中新增一个视点位置，并在C++代码中将摄像机的位置传给着色器。需要注意的是，程序中支持相机移动，那么每帧相机的位置都是不一样的，所以需要把设置视点位置的这行代码放在渲染循环内。
接下来就是计算镜面反射。通过计算反射方向和视线方向的点积衡量两个方向的接近程度，引入反射度控制高光的范围。并引入镜面反射强度，镜面反射颜色依旧是光源颜色。
![BQACAgUAAyEGAASHRsPbAAEWKhNqP0maDaU1tpQ5DYEhQ5wWr7EmxAAC4SIAAk05AVZbeWSlqPEQAAE8BA.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWKhNqP0maDaU1tpQ5DYEhQ5wWr7EmxAAC4SIAAk05AVZbeWSlqPEQAAE8BA.png)
```glsl
//fragmentShader
#version 330 core
in vec3 Normal;
in vec3 FragPos;
out vec4 FragColor;

uniform vec3 lightPos;
uniform vec3 viewPos;
uniform vec3 objectColor;
uniform vec3 lightColor;
void main(){
        float ambientStrength=0.1f;
        vec3 ambient = ambientStrength * lightColor;

        vec3 norm = normalize(Normal);
        vec3 lightDir = normalize(lightPos-FragPos);
        float diff = max(dot(norm,lightDir),0.0f);
        vec3 diffuse = diff * lightColor;

        float specularStrength = 0.5f;
        vec3 viewDir = normalize(viewPos - FragPos);
        vec3 reflectDir = reflect(-lightDir,norm);
        float spec = pow(max(dot(viewDir,reflectDir),0.0f),32);
        vec3 specular = specularStrength * spec * lightColor;
        vec3 result = objectColor * (ambient + diffuse + specular);
        FragColor = vec4(result,1.0);
}
```

# homework1
目前，我们的光源是**静止**的，你可以尝试使用`sin`或`cos`函数让光源在场景中来回移动。观察光照随时间的改变能让你更容易理解风氏光照模型。
*思路*：要让光源动起来，则需要**在渲染循环中每帧改变光源的位置**。然后使用`model`的**平移矩阵**将光源移动到新的位置上。计算光源位置的思路是使用`sin/cos`定义一个绕圈运动，定义半径，然后将**运行时间**作为自变量传入`sin/cos`，使用`rcos和rsin`即可计算出圆上任一点的坐标，将其作为光源的`x`和`z`坐标，`y`坐标不变，则光源就在平行于`xoz`平面的一个平面上绕着原点做绕圈运动。
**在实现过程中，需要注意使用光源位置的地方有两处，一是物体光照效果的计算需要用到光源位置去计算光源方向，二是光源本身的变换需要用到新的位置构造平移矩阵。**那么就需要确保计算光源新位置的逻辑在这两处使用的地方之前。此外，对于物体着色器使用到光源位置，这需要把光源坐标传递到`uniform`变量，这一行传递的命令必须在**激活物体着色器之后**、**调用物体绘制命令之前**，如果先绘制物体再传递，绘制物体时没有光源位置，光照效果就是黑的；如果没有激活物体着色器就传递了，那么物体用的永远是第一帧的光照位置，光照效果不会随着光源移动而变化。
```c
while (!glfwWindowShouldClose(window)) {
    float currentFrame = static_cast<float>(glfwGetTime());
    deltaTime = currentFrame - lastFrame;
    lastFrame = currentFrame;
        processInput(window);
        glClearColor(0.2f, 0.3f, 0.3f, 1.0f);
        glClear(GL_COLOR_BUFFER_BIT|GL_DEPTH_BUFFER_BIT);

    //计算光源新的位置
    float time = (float)glfwGetTime();
    float radius = 1.0f;
    lightPos.x = radius * sin(time);
    lightPos.z = radius * cos(time);

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

# homework2
尝试使用不同的环境光、漫反射和镜面强度，观察它们怎么是影响光照效果的。同样，尝试实验一下镜面光照的反光度因子。尝试理解为什么某一个值能够有着特定视觉输出。
*实验*：增大**环境光强度**（`ambientStrength=0.8`）：场景中的物体显得更亮了；同样的，增加**漫反射强度**（`float diff = max(dot(norm,lightDir),0.0f) * 2.0f;`），场景中的物体也是变得更亮了，和增大环境光强度的视觉效果差不多。
![BQACAgUAAyEGAASHRsPbAAEWKhlqP0pQEB6xbcfrtVh3yOgdf5CgQQAC6iIAAk05AVaNkkRyJ4UBeDwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWKhlqP0pQEB6xbcfrtVh3yOgdf5CgQQAC6iIAAk05AVaNkkRyJ4UBeDwE.png)
增大**镜面反射强度**（`specularStrength=1.0f`），物体表面的高光范围更大了。
![BQACAgUAAyEGAASHRsPbAAEWKhtqP0p6y26a6kvJNBjuwDYR88FQHAAC7SIAAk05AVb0ae8s6b9iwTwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWKhtqP0p6y26a6kvJNBjuwDYR88FQHAAC7SIAAk05AVb0ae8s6b9iwTwE.png)
增大**反光度**（`shininess=256`）：只有离得比较近的时候，才能看到小范围的高光。
![BQACAgUAAyEGAASHRsPbAAEWKh5qP0qdO--Tk3ec2TLbWxsKrlsAATgAAvAiAAJNOQFW1wABlRCx7QbePAQ.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWKh5qP0qdO--Tk3ec2TLbWxsKrlsAATgAAvAiAAJNOQFW1wABlRCx7QbePAQ.png)
减少**反光度**（`shininess=4`）：离得远也能看到大范围的高光。
![BQACAgUAAyEGAASHRsPbAAEWKiFqP0q-jAepP29g-oBi4hXCts_g3QAC8yIAAk05AVblSM_04WtkvTwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWKiFqP0q-jAepP29g-oBi4hXCts_g3QAC8yIAAk05AVblSM_04WtkvTwE.png)

# homework3
在**观察空间（而不是世界空间）**中计算风氏光照。
*思路*：在**观察空间**内计算光照，则需要把法向量、光源位置、相机位置都转为**观察空间**下的坐标。对于法向量，在顶点着色器中使用`view*model`的矩阵的**逆矩阵的转置矩阵**变换；对于光源位置，把在片元着色器中的定义的`uniform`变量移到顶点着色器，然后在顶点着色器中用`view`矩阵进行变换然后传给片元着色器；对于相机位置，可以仅修改在片元着色器中计算视线方向时的坐标，观察空间下的相机坐标就是`（0，0，0）`，所以视线方向就是片元位置的取反。
```glsl
//vertexShader
#version 330 core
layout (location = 0) in vec3 aPos;
layout (location = 1) in vec3 aNormal;

out vec3 Normal;
out vec3 FragPos;
out vec3 LightPos;

uniform mat4 model;
uniform mat4 view;
uniform mat4 project;

uniform vec3 lightPos;
void main(){
        gl_Position = project*view*model*vec4(aPos,1.0f);
        Normal=mat3(transpose(inverse(view*model)))*aNormal;
        FragPos=vec3(view*model*vec4(aPos,1.0f));
        LightPos = vec3(view*vec4(lightPos,1.0));
}
```
```glsl
//fragmentShader
#version 330 core
in vec3 Normal;
in vec3 FragPos;
in vec3 LightPos;
out vec4 FragColor;

uniform vec3 viewPos;
uniform vec3 objectColor;
uniform vec3 lightColor;
void main(){
        float ambientStrength=0.1f;
        vec3 ambient = ambientStrength * lightColor;

        vec3 norm = normalize(Normal);
        vec3 lightDir = normalize(LightPos-FragPos);
        float diff = max(dot(norm,lightDir),0.0f);
        vec3 diffuse = diff * lightColor;

        float specularStrength = 0.5f;
        vec3 viewDir = normalize(- FragPos);
        vec3 reflectDir = reflect(-lightDir,norm);
        float spec = pow(max(dot(viewDir,reflectDir),0.0f),32);
        vec3 specular = specularStrength * spec * lightColor;
        vec3 result = objectColor * (ambient + diffuse + specular);
        FragColor = vec4(result,1.0);
}
```

# homework4
尝试实现一个**Gouraud着色**（而不是风氏着色）。如果你做对了话，立方体的光照应该会看起来有些奇怪，尝试推理为什么它会看起来这么奇怪。
*思路*：把片元着色器的计算光照的逻辑搬到顶点着色器，同步的，需要把用到的`uniform`变量也在顶点着色器中定义。片元着色器只负责最后的颜色输出。
![BQACAgUAAyEGAASHRsPbAAEWKidqP0ubf6lNSp5lyXWFmhUXqZmw8gAC_SIAAk05AVZV5pv2MsGOJTwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWKidqP0ubf6lNSp5lyXWFmhUXqZmw8gAC_SIAAk05AVZV5pv2MsGOJTwE.png)
```glsl
//vertexShader
#version 330 core
layout (location = 0) in vec3 aPos;
layout (location = 1) in vec3 aNormal;

out vec3 ourColor;

uniform mat4 model;
uniform mat4 view;
uniform mat4 project;

uniform vec3 lightPos;
uniform vec3 viewPos;
uniform vec3 lightColor;
uniform vec3 objectColor;
void main(){
        gl_Position = project*view*model*vec4(aPos,1.0f);
        vec3 worldNormal=mat3(transpose(inverse(model)))*aNormal;
        vec3 worldPos=vec3(model*vec4(aPos,1.0f));
        
        float ambientStrength=0.1f;
        vec3 ambient = ambientStrength*lightColor;

        worldNormal=normalize(worldNormal);
        vec3 worldLightDir=normalize(lightPos-worldPos);
        float diff=max(dot(worldNormal,worldLightDir),0.0f);
        vec3 diffuse=diff*lightColor;

        vec3 worldViewDir=normalize(viewPos-worldPos);
        vec3 reflectDir=reflect(-worldLightDir,worldNormal);
        float spec=pow(max(dot(reflectDir,worldViewDir),0.0f),32);
        float specularStrength=0.5f;
        vec3 specular = specularStrength * lightColor * spec;
        
        ourColor=(ambient+diffuse+specular)*objectColor;
}
```
```glsl
//fragmentShader
#version 330 core
in vec3 ourColor;
out vec4 FragColor;
void main(){
        FragColor=vec4(ourColor,1.0);
}
```
我们可以看到立方体向光的这一面左上三角形和右下三角形共享的这条边特别亮而明显，把两个三角形分开了。出现这种效果的**原因是**：`Gouraud`是计算三角形的**顶点颜色**，中间的片元由顶点颜色**插值**，那么颜色强度一定会比顶点的小，那么对一个三角形来说，三个顶点的颜色强度>三条边的颜色强度>中间部分的颜色强度。也就是说共享边的颜色强度>它两边中间部分的颜色强度，所以就突出出来了。



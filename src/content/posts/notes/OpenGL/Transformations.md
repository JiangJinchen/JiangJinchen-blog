---
title: Transformations
published: 2026-06-27
description: 'Learn OpenGL 第一章第七节'
image: ''
tags: [OpenGL]
category: '学习笔记/OpenGL'
draft: false 
lang: 'zh'
---
# example1: 使用缩放和旋转变换之前的矩形箱子
*思路*：在顶点着色器中声明`uniform`类型的变换矩阵，并在`main`函数中将其作用于顶点位置。在`main.cpp`中，引入`glm`库，定义`mat4`类型的变换矩阵，使用`glm`库中的`rotate`方法和`scale`方法构造符合变换矩阵（**先缩放后旋转**），然后在**着色器激活**的情况下设置`uniform`变量的值。
![BQACAgUAAyEGAASHRsPbAAEWKWlqPzuOuvEv3jyWSCrMBBpTFBVlrwAC7iEAAk05AVZ14a851QABbe48BA.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWKWlqPzuOuvEv3jyWSCrMBBpTFBVlrwAC7iEAAk05AVZ14a851QABbe48BA.png)
```glsl
#version 330 core
layout (location = 0) in vec3 aPos;
layout (location = 1) in vec2 aTexcoord;

out vec2 ourTexcoord;

uniform mat4 transform;
void main(){
	gl_Position = transform*vec4(aPos,1.0f);
	ourTexcoord = aTexcoord;
}
```
```c
#define STB_IMAGE_IMPLEMENTATION
#include <glad/glad.h>
#include <GLFW/glfw3.h>
#include <stb_image.h>
#include <myShader.h>
#include <iostream>

#include <glm/glm.hpp>
#include <glm/gtc/matrix_transform.hpp>
#include <glm/gtc/type_ptr.hpp>

const unsigned int SCR_WIDTH = 800;
const unsigned int SCR_HEIGHT = 600;

void framebuffer_size_callback(GLFWwindow* window, int width, int height) {
	glViewport(0, 0, width, height);
}
void processInput(GLFWwindow* window) {
	if (glfwGetKey(window, GLFW_KEY_ESCAPE) == GLFW_PRESS) {
		glfwSetWindowShouldClose(window, true);
	}
}

int main() {
	glfwInit();
	glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 3);
	glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 3);
	glfwWindowHint(GLFW_OPENGL_PROFILE, GLFW_OPENGL_CORE_PROFILE);

	GLFWwindow* window = glfwCreateWindow(SCR_WIDTH, SCR_HEIGHT, "LearnOpenGL", NULL, NULL);
	if (window == NULL) {
		cout << "Failed to create GLFW window" << endl;
		glfwTerminate();
		return -1;
	}
	glfwMakeContextCurrent(window);
	glfwSetFramebufferSizeCallback(window, framebuffer_size_callback);

	if (!gladLoadGLLoader((GLADloadproc)glfwGetProcAddress)) {
		cout << "Failed to initialize GLAD" << endl;
		glfwTerminate();
		return -1;
	}

	Shader ourShader("src/Shader/vertexShader.txt", "src/Shader/fragmentShader.txt");

	float vertices[] = {
		0.5f,0.5f,0.0f, 1.0f,1.0f,//右上
		0.5f,-0.5f,0.0f, 1.0f,0.0f,//右下
		-0.5f,-0.5f,0.0f, 0.0f,0.0f,//左下
		-0.5f,0.5f,0.0f, 0.0f,1.0f//左上
	};

	unsigned int indices[] = {
		0,1,3,
		1,2,3
	};

	unsigned int VBO, VAO,EBO;
	glGenVertexArrays(1, &VAO);
	glGenBuffers(1, &VBO);
	glGenBuffers(1, &EBO);

	glBindVertexArray(VAO);
	glBindBuffer(GL_ARRAY_BUFFER, VBO);
	glBufferData(GL_ARRAY_BUFFER, sizeof(vertices), vertices, GL_STATIC_DRAW);
	glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, EBO);
	glBufferData(GL_ELEMENT_ARRAY_BUFFER, sizeof(indices), indices, GL_STATIC_DRAW);

	glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 5 * sizeof(float), (void*)0);
	glEnableVertexAttribArray(0);
	glVertexAttribPointer(1, 2, GL_FLOAT, GL_FALSE, 5 * sizeof(float), (void*)(3 * sizeof(float)));
	glEnableVertexAttribArray(1);

	glBindVertexArray(0);

	unsigned int texture1, texture2;
	glGenTextures(1, &texture1);
	glBindTexture(GL_TEXTURE_2D, texture1);
	glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
	glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
	glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR_MIPMAP_LINEAR);
	glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR_MIPMAP_LINEAR);

	int width, height, nrChannels;
	stbi_set_flip_vertically_on_load(true);
	unsigned char* data = stbi_load("resources/textures/container.jpg", &width, &height, &nrChannels, 0);
	if (data) {
		glTexImage2D(GL_TEXTURE_2D, 0, GL_RGB, width, height, 0, GL_RGB, GL_UNSIGNED_BYTE, data);
		glGenerateMipmap(GL_TEXTURE_2D);
	}
	else {
		cout << "Failed to load texture" << endl;
	}
	stbi_image_free(data);

	glGenTextures(1, &texture2);
	glBindTexture(GL_TEXTURE_2D, texture2);
	glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
	glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
	glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR_MIPMAP_LINEAR);
	glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR_MIPMAP_LINEAR);
	data = stbi_load("resources/textures/awesomeface.png", &width, &height, &nrChannels, 0);
	if (data) {
		glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA, width, height, 0, GL_RGBA, GL_UNSIGNED_BYTE, data);
		glGenerateMipmap(GL_TEXTURE_2D);
	}
	else {
		cout << "Failed to load image" << endl;
	}
	stbi_image_free(data);

	ourShader.use();
	ourShader.setInt("texture1", 0);
	ourShader.setInt("texture2", 1);
	glm::mat4 trans;
	trans = glm::rotate(trans, glm::radians(90.0f), glm::vec3(0.0, 0.0, 1.0));
	trans = glm::scale(trans, glm::vec3(0.5, 0.5, 0.5));
	unsigned int transformLoc = glGetUniformLocation(ourShader.ID, "transform");
	glUniformMatrix4fv(transformLoc, 1, GL_FALSE, glm::value_ptr(trans));//这个函数的最后一个参数需要一个float*类型的指针，而glm::mat4是GLM自己的矩阵类，内部有16个连续的float，所以需要value_ptr获取矩阵的首地址，转换数据类型

	while (!glfwWindowShouldClose(window)) {
		processInput(window);
		glClearColor(0.2f, 0.3f, 0.3f, 1.0f);
		glClear(GL_COLOR_BUFFER_BIT);

		glActiveTexture(GL_TEXTURE0);
		glBindTexture(GL_TEXTURE_2D, texture1);
		glActiveTexture(GL_TEXTURE1);
		glBindTexture(GL_TEXTURE_2D, texture2);

		ourShader.use();
		glBindVertexArray(VAO);
		glDrawElements(GL_TRIANGLES, 6, GL_UNSIGNED_INT, 0);

		glfwSwapBuffers(window);
		glfwPollEvents();
	}
	glDeleteVertexArrays(1, &VAO);
	glDeleteBuffers(1, &VBO);
	glDeleteBuffers(1, &EBO);

	glfwTerminate();
	return 0;
}
```
# example2: 让箱子移动到屏幕右下角，并随着时间旋转
*思路*：因为需要随着时间更新旋转角度，所以`uniform`变量的设置需要在循环内部。使用**运行时间**作为旋转角度，运行时间越长，则旋转角度越大，而且运行时间是均匀递增的，所以角度变换也是均匀的。然后应用缩放和平移。此外，要注意变换矩阵在每一次循环中都要重新定义，否则只会在上一帧旋转角度上累加运行时间变换的角度，只会越转越多，而不是均匀的。
```c
while (!glfwWindowShouldClose(window)) {
	processInput(window);
	glClearColor(0.2f, 0.3f, 0.3f, 1.0f);
	glClear(GL_COLOR_BUFFER_BIT);

	glActiveTexture(GL_TEXTURE0);
	glBindTexture(GL_TEXTURE_2D, texture1);
	glActiveTexture(GL_TEXTURE1);
	glBindTexture(GL_TEXTURE_2D, texture2);

	ourShader.use();
	glm::mat4 trans;
	trans = glm::translate(trans, glm::vec3(0.5, -0.5, 0.0));
	trans = glm::scale(trans, glm::vec3(0.5, 0.5, 0.5));
	trans = glm::rotate(trans, (float)glfwGetTime(), glm::vec3(0.0, 0.0, 1.0));
	unsigned int transformLoc = glGetUniformLocation(ourShader.ID, "transform");
	glUniformMatrix4fv(transformLoc, 1, GL_FALSE, glm::value_ptr(trans));
	glBindVertexArray(VAO);
	glDrawElements(GL_TRIANGLES, 6, GL_UNSIGNED_INT, 0);

	glfwSwapBuffers(window);
	glfwPollEvents();
}
```

# homework1
使用应用在箱子上的最后一个变换，尝试将其改变为先旋转，后位移。看看发生了什么，试着想想为什么会发生这样的事情.

*思路*：仅调换旋转和平移两行的顺序，使其先应用平移再应用旋转。则会观察到物体不绕着自己的中心旋转，而是绕着屏幕原点旋转，即沿着一个大圆圈绕圈。

*原因*：`glm::scale/glm::rotate`始终都是以**屏幕原点**为基准进行变换，在未平移时，物体的中心就是屏幕原点（根据定义的`vertices`数组可知），则缩放和旋转都相当于是以**物体中心**为基准，可以得到我们想要的效果。但是如果先平移了，那么物体中心和屏幕原点不再重合，就会导致意料之外的效果。
```c
while (!glfwWindowShouldClose(window)) {
	processInput(window);
	glClearColor(0.2f, 0.3f, 0.3f, 1.0f);
	glClear(GL_COLOR_BUFFER_BIT);

	glActiveTexture(GL_TEXTURE0);
	glBindTexture(GL_TEXTURE_2D, texture1);
	glActiveTexture(GL_TEXTURE1);
	glBindTexture(GL_TEXTURE_2D, texture2);

	ourShader.use();
	glm::mat4 trans;

	trans = glm::rotate(trans, (float)glfwGetTime(), glm::vec3(0.0, 0.0, 1.0));
	trans = glm::scale(trans, glm::vec3(0.5, 0.5, 0.5));
	trans = glm::translate(trans, glm::vec3(1, -1, 0.0));
	
	unsigned int transformLoc = glGetUniformLocation(ourShader.ID, "transform");
	glUniformMatrix4fv(transformLoc, 1, GL_FALSE, glm::value_ptr(trans));
	glBindVertexArray(VAO);
	glDrawElements(GL_TRIANGLES, 6, GL_UNSIGNED_INT, 0);

	glfwSwapBuffers(window);
	glfwPollEvents();
}
```

# homework2
尝试再次调用`glDrawElements`画出第二个箱子，**只**使用变换将其摆放在不同的位置。让这个箱子被摆放在窗口的左上角，并且会不断的缩放（而不是旋转）。（`sin`函数在这里会很有用，不过注意使用`sin`函数时应用负值会导致物体被翻转）。

*思路*：绘制第二个箱子不需要重复定义`vertices`或是修改着色器代码，只需传入不同的`transform`。而传入时机仍在渲染循环内，可以先计算第一个三角形的`transform`，然后设置、传入、绘制，再计算第二个三角形的`transform`，设置、传入和绘制。即调用两次`glDrawElements`，为每次调用计算**不同的变换矩阵**和设置调用着色器时的`transform`。不断的缩放的实现思路是借助`sin`函数，以**运行时间**作为自变量，`sin`函数自会将其限制在`-1-1`之间，而正因为`sin`函数可能取**负值**，当给物体应用负值的缩放，会**翻转物体**，这不是我们想要的，所以需要对`sin`结果做重映射，将其映射到`0-1`.
```c
while (!glfwWindowShouldClose(window)) {
	processInput(window);
	glClearColor(0.2f, 0.3f, 0.3f, 1.0f);
	glClear(GL_COLOR_BUFFER_BIT);

	glActiveTexture(GL_TEXTURE0);
	glBindTexture(GL_TEXTURE_2D, texture1);
	glActiveTexture(GL_TEXTURE1);
	glBindTexture(GL_TEXTURE_2D, texture2);

	ourShader.use();
	glBindVertexArray(VAO);
	//画第一个箱子，右下角，随时间旋转
	glm::mat4 trans1;

	trans1 = glm::translate(trans1, glm::vec3(0.5, -0.5, 0.0));
	trans1 = glm::scale(trans1, glm::vec3(0.5, 0.5, 0.5));
	trans1 = glm::rotate(trans1, (float)glfwGetTime(), glm::vec3(0.0, 0.0, 1.0));
	
	unsigned int transformLoc = glGetUniformLocation(ourShader.ID, "transform");
	glUniformMatrix4fv(transformLoc, 1, GL_FALSE, glm::value_ptr(trans1));
	glDrawElements(GL_TRIANGLES, 6, GL_UNSIGNED_INT, 0);


	//画第二个箱子，左下角，随时间缩放
	glm::mat4 trans2;
	trans2 = glm::translate(trans2, glm::vec3(-0.5, -0.5, 0.0));
	float scale = (glm::sin(glfwGetTime()) + 1.0) / 2.0;
	trans2 = glm::scale(trans2, glm::vec3(scale));
	transformLoc = glGetUniformLocation(ourShader.ID, "transform");
	glUniformMatrix4fv(transformLoc, 1, GL_FALSE, glm::value_ptr(trans2));
	glDrawElements(GL_TRIANGLES, 6, GL_UNSIGNED_INT, 0);

	glfwSwapBuffers(window);
	glfwPollEvents();
}
```

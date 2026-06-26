---
title: Shader
published: 2026-06-21
description: 'Learn OpenGL 第一章第二节'
image: ''
tags: [OpenGL]
category: '学习笔记/OpenGL'
draft: false 
lang: 'zh'
---

# GLSL 基础语法

## 一、GLSL 简介
GLSL 是一种类 C 语言，专门用于编写渲染管线中的各类着色器程序，是 OpenGL 着色器的核心编写语言。

## 二、GLSL 着色器基本结构
标准 GLSL 着色器文件包含版本声明、各类变量声明与主函数，整体结构固定，示例框架如下：

```glsl
#version version_number
// 顶点输入变量
in type in_variable_name;
in type in_variable_name;

// 片段输出变量
out type out_variable_name;

// 全局统一变量
uniform type uniform_name;

void main(){
    // 处理输入数据、执行图形相关运算
    ...
    // 将最终计算结果赋值给输出变量，完成数据输出
    out_variable_name = weird_stuff_we_processed;
}
```

## 三、GLSL 变量输入输出规则

### 1. in / out 常规变量
GLSL 通过专属关键字区分着色器输入、输出变量，严格限定读写权限：**in** 为输入变量，只读不可写；**out** 为输出变量，只写不可读。每个着色器均通过这两个关键字定义自身的输入输出接口。

着色器管线的数据跨阶段传递有固定匹配规则：上一级着色器的 out 输出变量，与下一级着色器的 in 输入变量 **名称、类型完全一致** 时，渲染管线会自动将两个变量链接绑定，实现数据自动传递流转。

### 2. inout 双向变量
不同于 in、out 单向变量，**inout** 关键字修饰的变量支持可读可写，兼具输入和输出能力，本质为引用传递。

着色器会先接收该变量的原始数值作为输入，在程序内部对变量进行修改后，可将修改后的新值重新输出，实现变量数值的更新与跨阶段传递。

### 3. 顶点着色器输入专属标识
顶点着色器的 in 输入变量支持专属标识 **layout(location=xx)**，用于显式指定当前顶点属性在 VBO 中的索引位置，精准匹配显存中的顶点数据，运行效率更高，是开发首选写法。

该标识为可选配置，若不使用，可通过 `glGetAttribLocation` 函数动态查询顶点属性位置。但动态查询会增加 OpenGL 额外运算开销，影响渲染效率，实际开发中应尽量避免。

### 4. uniform 全局变量
**uniform** 修饰的变量为着色器全局变量，可在着色器任意位置定义、修改和调用，无需依赖着色器阶段之间的 in/out 数据传递，是独立的全局数据载体。

uniform 变量无法自动链接传递，使用前必须遵循固定流程：首先通过 `glGetUniformLocation`（原文笔误修正：非 glGetAttribLocation）函数，传入着色器程序对象与变量名，查询获取 uniform 变量的位置索引；再激活对应着色器程序，最终完成变量的修改与使用。

# example1:uniform变量的使用
这是一个全局变量，在顶点/片元着色器内部定义，在C++代码处/着色器内部赋值。无需靠两个着色器之间的传递。注意：赋值uniform变量前需要查询uniform变量的位置，这就要用到`glGetAttribLocation`函数，传入着色器程序名和要查询的变量名，然后激活对应的着色器程序，才能进行修改和使用。
```c
#include <glad/glad.h>
#include <GLFW/glfw3.h>

#include <iostream>
#include <cmath>

using namespace std;

void framebuffer_size_callback(GLFWwindow* window, int width, int height) {
	glViewport(0, 0, width, height);
}

void processInput(GLFWwindow* window) {
	if (glfwGetKey(window, GLFW_KEY_ESCAPE) == GLFW_PRESS) {
		glfwSetWindowShouldClose(window, true);
	}
}

const unsigned int SCR_WIDTH = 800;
const unsigned int SCR_HEIGHT = 600;

const char* vertexShaderSource = "#version 330 core\n"
"layout (location = 0) in vec3 aPos;\n"
"void main(){\n"
"	gl_Position=vec4(aPos,1.0);\n"
"}\n\0";

const char* fragmentShaderSource = "#version 330 core\n"
"out vec4 FragColor;\n"
"uniform vec4 ourColor;\n"//在这定义的uniform
"void main(){\n"
"	FragColor = ourColor;\n"
"}\n\0";

int main() {
	glfwInit();
	glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 3);
	glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 3);
	glfwWindowHint(GLFW_OPENGL_PROFILE, GLFW_OPENGL_CORE_PROFILE);

	GLFWwindow* window = glfwCreateWindow(SCR_WIDTH, SCR_HEIGHT, "LearnOpenGL", NULL, NULL);
	if (window == NULL) {
		cout << "Failed to Create GLFW window" << endl;
		glfwTerminate();//只有GLFW初始化了，但运行中途失败了，就需要释放资源
		return -1;
	}
	glfwMakeContextCurrent(window);
	glfwSetFramebufferSizeCallback(window, framebuffer_size_callback);

	if (!gladLoadGLLoader((GLADloadproc)glfwGetProcAddress)) {
		cout << "Failed to Initialize GLAD" << endl;
		glfwTerminate();
		return -1;
	}

	unsigned int vertexShader = glCreateShader(GL_VERTEX_SHADER);
	glShaderSource(vertexShader, 1, &vertexShaderSource, NULL);//第四个参数NULL表示自动计算长度
	glCompileShader(vertexShader);

	int success;
	char infoLog[512];
	glGetShaderiv(vertexShader, GL_COMPILE_STATUS, &success);
	if (!success) {
		glGetShaderInfoLog(vertexShader, 512, NULL, infoLog);
		cout << "ERROR::SHADER::VERTEX::COMPILATION_FAILED\n" << infoLog << endl;
	}

	unsigned int fragmentShader = glCreateShader(GL_FRAGMENT_SHADER);
	glShaderSource(fragmentShader, 1, &fragmentShaderSource, NULL);
	glCompileShader(fragmentShader);
	glGetShaderiv(fragmentShader, GL_COMPILE_STATUS, &success);

	if (!success) {
		glGetShaderInfoLog(fragmentShader, 512, NULL, infoLog);
		cout << "ERROR::SHADER::FRAGMENT::COMPILATION_FAILED\n" << infoLog << endl;
	}

	unsigned int shaderProgram = glCreateProgram();
	glAttachShader(shaderProgram, vertexShader);
	glAttachShader(shaderProgram, fragmentShader);
	glLinkProgram(shaderProgram);
	glGetProgramiv(shaderProgram, GL_LINK_STATUS, &success);
	if (!success) {
		glGetProgramInfoLog(shaderProgram, 512, NULL, infoLog);
		cout << "ERROR::SHADER::PROGRAM::LINKING_FAILED\n" << infoLog << endl;
	}

	glDeleteShader(vertexShader);
	glDeleteShader(fragmentShader);

	float vertices[] = {
		0.5f,-0.5f,0.0f,
		-0.5f,-0.5f,0.0f,
		0.0f,0.5f,0.0f
	};

	unsigned int VBO, VAO;
	glGenBuffers(1, &VBO);
	glGenVertexArrays(1, &VAO);

	glBindVertexArray(VAO);

	glBindBuffer(GL_ARRAY_BUFFER, VBO);
	glBufferData(GL_ARRAY_BUFFER, sizeof(vertices), vertices, GL_STATIC_DRAW);

	glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 3 * sizeof(float), (void*)0);
	glEnableVertexAttribArray(0);

	//解绑VAO
	//glBindVertexArray(0);
	//这一句大多数情况下可以省略。因为解绑VAO是为了避免其他VAO调用意外修改此VAO，但是由于调用其他VAO之前必须先绑定那个VAO，所以这种情况很少发生

	//绑定VAO（即把本该在渲染循环里写的绑定VAO语句搬到了循环外面，因为当我们只有一个VAO时，可以在渲染响应三角形之前先将其绑定）
	glBindVertexArray(VAO);

	while (!glfwWindowShouldClose(window)) {
		processInput(window);

		glClearColor(0.2f, 0.3f, 0.3f, 1.0f);
		glClear(GL_COLOR_BUFFER_BIT);//这里的参数表明清空的是颜色缓冲区

		glUseProgram(shaderProgram);

		//这里省略了绑定VAO（已经在循环外面写了）
		//在这修改uniform
		double timeValue = glfwGetTime();
		float greenValue = static_cast<float>(sin(timeValue) / 2.0 + 0.5);//sin值是-1-1，这样变换之后，范围是0-1
		int vertexColorLocation = glGetUniformLocation(shaderProgram, "ourColor");
		glUniform4f(vertexColorLocation, 0.0f, greenValue, 0.0f, 1.0f);//greenValue=0时是黑色，greenValue=1时是绿色

		glDrawArrays(GL_TRIANGLES, 0, 3);

		glfwSwapBuffers(window);
		glfwPollEvents();
	}

	glDeleteVertexArrays(1, &VAO);
	glDeleteBuffers(1, &VBO);
	glDeleteProgram(shaderProgram);

	glfwTerminate();
	return 0;
}
```

# example2: 填充更多顶点属性
可以在顶点数组中插入更多的属性值，OpenGL最多支持16个顶点输入属性。然后修改顶点着色器，使之能够接收更多的输入属性（同样使用`layout(location=xx)`指明属性的位置值），处理更多的输入属性，以及输出更多的输出属性。此外，片元着色器也需要增加对应的输入属性。在绑定VAO后，还需修改VBO的设置，明确不同属性的**位置值**、**步长**、**起始偏移**等。
![BQACAgUAAyEGAASHRsPbAAEV1XVqN_ejnkqmwIGwLO82Cu6gqlIE5wAC2yIAAqOTwVU3LKDEcrNA3zwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEV1XVqN_ejnkqmwIGwLO82Cu6gqlIE5wAC2yIAAqOTwVU3LKDEcrNA3zwE.png)
![BQACAgUAAyEGAASHRsPbAAEV1XZqN_fMWgHHISFVnCFJma2J9t-TowAC3iIAAqOTwVX0uJf648NdPjwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEV1XZqN_fMWgHHISFVnCFJma2J9t-TowAC3iIAAqOTwVX0uJf648NdPjwE.png)
```c
#include <glad/glad.h>
#include <GLFW/glfw3.h>

#include <iostream>
#include <cmath>

using namespace std;

void framebuffer_size_callback(GLFWwindow* window, int width, int height) {
	glViewport(0, 0, width, height);
}

void processInput(GLFWwindow* window) {
	if (glfwGetKey(window, GLFW_KEY_ESCAPE) == GLFW_PRESS) {
		glfwSetWindowShouldClose(window, true);
	}
}

const unsigned int SCR_WIDTH = 800;
const unsigned int SCR_HEIGHT = 600;

const char* vertexShaderSource = "#version 330 core\n"
"layout (location = 0) in vec3 aPos;\n"
"layout (location = 1) in vec3 aColor;\n"
"out vec3 ourColor;\n"
"void main(){\n"
"	gl_Position=vec4(aPos,1.0);\n"
"	ourColor = aColor;\n"
"}\n\0";

const char* fragmentShaderSource = "#version 330 core\n"
"out vec4 FragColor;\n"
"in vec3 ourColor;"
"void main(){\n"
"	FragColor = vec4(ourColor,1.0);\n"
"}\n\0";

int main() {
	glfwInit();
	glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 3);
	glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 3);
	glfwWindowHint(GLFW_OPENGL_PROFILE, GLFW_OPENGL_CORE_PROFILE);

	GLFWwindow* window = glfwCreateWindow(SCR_WIDTH, SCR_HEIGHT, "LearnOpenGL", NULL, NULL);
	if (window == NULL) {
		cout << "Failed to Create GLFW window" << endl;
		glfwTerminate();//只有GLFW初始化了，但运行中途失败了，就需要释放资源
		return -1;
	}
	glfwMakeContextCurrent(window);
	glfwSetFramebufferSizeCallback(window, framebuffer_size_callback);

	if (!gladLoadGLLoader((GLADloadproc)glfwGetProcAddress)) {
		cout << "Failed to Initialize GLAD" << endl;
		glfwTerminate();
		return -1;
	}

	unsigned int vertexShader = glCreateShader(GL_VERTEX_SHADER);
	glShaderSource(vertexShader, 1, &vertexShaderSource, NULL);//第四个参数NULL表示自动计算长度
	glCompileShader(vertexShader);

	int success;
	char infoLog[512];
	glGetShaderiv(vertexShader, GL_COMPILE_STATUS, &success);
	if (!success) {
		glGetShaderInfoLog(vertexShader, 512, NULL, infoLog);
		cout << "ERROR::SHADER::VERTEX::COMPILATION_FAILED\n" << infoLog << endl;
	}

	unsigned int fragmentShader = glCreateShader(GL_FRAGMENT_SHADER);
	glShaderSource(fragmentShader, 1, &fragmentShaderSource, NULL);
	glCompileShader(fragmentShader);
	glGetShaderiv(fragmentShader, GL_COMPILE_STATUS, &success);

	if (!success) {
		glGetShaderInfoLog(fragmentShader, 512, NULL, infoLog);
		cout << "ERROR::SHADER::FRAGMENT::COMPILATION_FAILED\n" << infoLog << endl;
	}

	unsigned int shaderProgram = glCreateProgram();
	glAttachShader(shaderProgram, vertexShader);
	glAttachShader(shaderProgram, fragmentShader);
	glLinkProgram(shaderProgram);
	glGetProgramiv(shaderProgram, GL_LINK_STATUS, &success);
	if (!success) {
		glGetProgramInfoLog(shaderProgram, 512, NULL, infoLog);
		cout << "ERROR::SHADER::PROGRAM::LINKING_FAILED\n" << infoLog << endl;
	}

	glDeleteShader(vertexShader);
	glDeleteShader(fragmentShader);

	float vertices[] = {
		0.5f,-0.5f,0.0f, 1.0f,0.0f,0.0f,
		-0.5f,-0.5f,0.0f, 0.0f,1.0f,0.0f,
		0.0f,0.5f,0.0f, 0.0f,0.0f,1.0f
	};

	unsigned int VBO, VAO;
	glGenBuffers(1, &VBO);
	glGenVertexArrays(1, &VAO);

	glBindVertexArray(VAO);

	glBindBuffer(GL_ARRAY_BUFFER, VBO);
	glBufferData(GL_ARRAY_BUFFER, sizeof(vertices), vertices, GL_STATIC_DRAW);

	glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 6 * sizeof(float), (void*)0);
	glEnableVertexAttribArray(0);

	glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, 6 * sizeof(float), (void*)(3 * sizeof(float)));
	glEnableVertexAttribArray(1);

	//解绑VAO
	//glBindVertexArray(0);
	//这一句大多数情况下可以省略。因为解绑VAO是为了避免其他VAO调用意外修改此VAO，但是由于调用其他VAO之前必须先绑定那个VAO，所以这种情况很少发生

	//绑定VAO（即把本该在渲染循环里写的绑定VAO语句搬到了循环外面，因为当我们只有一个VAO时，可以在渲染响应三角形之前先将其绑定）
	glBindVertexArray(VAO);

	while (!glfwWindowShouldClose(window)) {
		processInput(window);

		glClearColor(0.2f, 0.3f, 0.3f, 1.0f);
		glClear(GL_COLOR_BUFFER_BIT);//这里的参数表明清空的是颜色缓冲区

		glUseProgram(shaderProgram);

		//这里省略了绑定VAO（已经在循环外面写了）
		//在这修改uniform
		double timeValue = glfwGetTime();
		float greenValue = static_cast<float>(sin(timeValue) / 2.0 + 0.5);//sin值是-1-1，这样变换之后，范围是0-1
		int vertexColorLocation = glGetUniformLocation(shaderProgram, "ourColor");
		glUniform4f(vertexColorLocation, 0.0f, greenValue, 0.0f, 1.0f);//greenValue=0时是黑色，greenValue=1时是绿色

		glDrawArrays(GL_TRIANGLES, 0, 3);

		glfwSwapBuffers(window);
		glfwPollEvents();
	}

	glDeleteVertexArrays(1, &VAO);
	glDeleteBuffers(1, &VBO);
	glDeleteProgram(shaderProgram);

	glfwTerminate();
	return 0;
}
```

# example3: 自定义着色器类
该类读取硬盘上的顶点着色器和片元着色器并使用他们创建一个**着色器程序**，完成编译、链接等操作。此外，还提供了激活着色器程序的方法（内部调用`glUseProgram`），设置uniform变量值的方法（找到它的位置并设置值）。

其中的关键函数是创建着色器程序的构造函数。首先需要定义文件句柄用于读取文件内容，然后定义数据流对象，将文件内容读取到数据流中，转为字符串对象，最后转为C++ 字符对象以供OpenGL解析。然后就是常规的创建顶点/片元着色器、传递源码、编译。创建着色器程序、链接、删除着色器。
```c
//自定义着色器类的头文件内容
#pragma once
#ifndef SHADER_H
#define SHADER_H
//以上预处理指令（包含最后的#endif告知编译器只在这个头文件没被包含过的情况下才包含和编译，防止链接冲突

#include <glad/glad.h>//包含glad来获取所有必须的OpenGL头文件
#include <string>//存储着色器源码
#include <fstream>//用ifstream读取外部文件
#include <sstream>//用stringstream把文件内容转成字符串
#include <iostream>//用cout打印错误信息

using namespace std;

class Shader {
public:
	unsigned int ID;//着色器程序ID。着色器程序将顶点着色器、片元着色器组装起来
	//下面这是着色器构造函数
	Shader(const char* vertexPath, const char* fragmentPath) {
		//1.从文件路径中获取顶点/片元着色器
		string vertexCode;//存储顶点着色器源码的字符串对象
		string fragmentCode;
		ifstream vShaderFile;//ifstream对象是一个文件读取对象，用于打开外部着色器文件
		ifstream fShaderFile;

		//ifstream对象读取失败可抛出异常
		vShaderFile.exceptions(ifstream::failbit | ifstream::badbit);
		fShaderFile.exceptions(ifstream::failbit | ifstream::badbit);

		try {
			//打开文件
			vShaderFile.open(vertexPath);
			fShaderFile.open(fragmentPath);
			stringstream vShaderStream, fShaderStream;//stringstream是字符流对象，相当于一个临时缓冲区，把从文件读到的内容，先存到流里，再转成字符串
			//读取文件的缓冲内容到数据流中
			vShaderStream << vShaderFile.rdbuf();
			fShaderStream << fShaderFile.rdbuf();
			//关闭文件处理器
			vShaderFile.close();
			fShaderFile.close();

			//转换数据流到string
			vertexCode = vShaderStream.str();
			fragmentCode = fShaderStream.str();
		}
		catch(ifstream::failure e){
			cout << "ERROR::SHADER::FILE_NOT_SUCCESSFULLY_READ" << endl;
		}
		const char* vShaderCode = vertexCode.c_str();//string是C++字符串，OpenGL只认识C语言的const char*，所以必须用c_str进行数据类型转换
		const char* fShaderCode = fragmentCode.c_str();

		//2.编译和链接着色器
		unsigned int vertex, fragment;
		int success;
		char infoLog[512];
		vertex = glCreateShader(GL_VERTEX_SHADER);
		glShaderSource(vertex, 1, &vShaderCode, NULL);
		glCompileShader(vertex);
		glGetShaderiv(vertex, GL_COMPILE_STATUS, &success);
		if (!success) {
			glGetShaderInfoLog(vertex, 512, NULL, infoLog);
			cout << "ERROR::SHADER::VERTEX::COMPILATION_FAILED\n" << endl;
		}

		fragment = glCreateShader(GL_FRAGMENT_SHADER);
		glShaderSource(fragment, 1, &fShaderCode, NULL);
		glCompileShader(fragment);
		glGetShaderiv(fragment, GL_COMPILE_STATUS, &success);
		if (!success) {
			glGetShaderInfoLog(fragment, 512, NULL, infoLog);
			cout << "ERROR::SHADER::FRAGMENT::COMPILATION_FAILED\n" << endl;
		}

		//创建着色器程序
		ID = glCreateProgram();
		//链接
		glAttachShader(ID, vertex);
		glAttachShader(ID, fragment);
		glLinkProgram(ID);
		glGetProgramiv(ID, GL_LINK_STATUS, &success);
		if (!success) {
			glGetProgramInfoLog(ID, 512, NULL, infoLog);
			cout << "ERROR::SHADER::PROGRAM::LINKING_FAILED\n" << infoLog << endl;
		}
		glDeleteShader(vertex);
		glDeleteShader(fragment);
	};
	//激活函数
	void use() {
		glUseProgram(ID);
	};
	//uniform工具函数
	//每次设置uniform变量时都需要先获取uniform变量的位置，再设置。以下工具函数把这两行代码抽象为一个函数，可直接调用完成设置
	void setBool(const string& name, bool value) const {
		glUniform1i(glGetUniformLocation(ID, name.c_str()), (int)value);
	};//这里的两个参数分别是uniform变量的名字和要设置的值
	void setInt(const string& name, int value) const {
		glUniform1i(glGetUniformLocation(ID, name.c_str()), value);
	};
	void setFloat(const string& name, float value) const {
		glUniform1f(glGetUniformLocation(ID, name.c_str()), value);
	};
};
#endif
```

# homework1
修改顶点着色器让三角形上下颠倒。
![BQACAgUAAyEGAASHRsPbAAEV1X1qN_iNXxAtc4kQT4Fnq6ledXMOYAAC6yIAAqOTwVWvXSU1xsqTGjwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEV1X1qN_iNXxAtc4kQT4Fnq6ledXMOYAAC6yIAAqOTwVWvXSU1xsqTGjwE.png)

*思路*：
```plaintext
//上下颠倒之后
//右下->右上 即 0.5f,-0.5f,0.0f → 0.5,0.5,0.0
//左下->左上 即 -0.5f,-0.5f,0.0f → -0.5,0.5,0.0
//中上->中下 即 0.0f,0.5f,0.0f → 0.0,-0.5,0.0
```
观察发现，上下颠倒只是对y坐标进行了取反，所以修改顶点着色器如下：
```glsl
#version 330 core
layout (location = 0) in vec3 aPos;
layout (location = 1) in vec3 aColor;

out vec3 ourColor;
void main(){
	vec3 pos = aPos;
	pos.y = -pos.y;
	gl_Position = vec4(pos,1.0);
	ourColor = aColor;
}
```
在编写时还需要注意，`in`关键字修饰的变量是**只读不可写**的，所以不能直接`aPos.y=-aPos.y`，会报编译错误。所以需要定义一个新变量来操纵。或者直接下面这样写：
```glsl
#version 330 core
layout (location = 0) in vec3 aPos;
layout (location = 1) in vec3 aColor;

out vec3 ourColor;
void main(){
	gl_Position = vec4(aPos.x,-aPos.y,aPos.z,1.0);
	ourColor = aColor;
}
```
此外，由于颜色属性和顶点是强绑定的（哪个顶点对应哪个颜色），所以改了顶点位置，对应的颜色也会同步改，不需要单独变换颜色。

# homework2
使用uniform定义一个水平偏移量，在顶点着色器中使用这个偏移量把三角形移动到屏幕右侧。

*思路*：在顶点着色器内部顶点float类型的uniform变量offset，然后在main函数中将其叠加到输入aPos的x分量。在main.cpp的渲染循环中使用自定义Shader类中的setFloat设置offset的值。
```glsl
//顶点着色器
#version 330 core
layout (location = 0) in vec3 aPos;
layout (location = 1) in vec3 aColor;

out vec3 ourColor;
uniform float offset;
void main(){
	gl_Position = vec4(aPos.x+offset,aPos.y,aPos.z,1.0);
	ourColor = aColor;
}
```
```c
//main.cpp代码内部的渲染循环
while (!glfwWindowShouldClose(window)) {
	processInput(window);

	glClearColor(0.2f, 0.3f, 0.3f, 1.0f);
	glClear(GL_COLOR_BUFFER_BIT);//这里的参数表明清空的是颜色缓冲区

	ourShader.use();
	glBindVertexArray(VAO);
	ourShader.setFloat("offset", 0.5);
	glDrawArrays(GL_TRIANGLES, 0, 3);

	glfwSwapBuffers(window);
	glfwPollEvents();
}
```

# homework3
使用`out`关键字把顶点位置输出到片段着色器，并将片段的颜色设置为与顶点位置相等（来看看连顶点位置值都在三角形中被插值的结果）。做完这些后，尝试回答下面的问题：为什么在三角形的左下角是黑的?
*思路*：在顶点着色器中新声明一个输出变量`ourPos`，并在`main`函数内部使用输入的`aPos`变量赋值，传递给片元着色器。在片元着色器中新声明一个输入变量`ourPos`，并在`main`函数内部将`ourPos`直接作为输出颜色值。
![BQACAgUAAyEGAASHRsPbAAEV1Y5qN_mjNFSAg37RXtemdrZdY48swAAC_iIAAqOTwVW9xT9cdotK9jwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEV1Y5qN_mjNFSAg37RXtemdrZdY48swAAC_iIAAqOTwVW9xT9cdotK9jwE.png)
```glsl
//顶点着色器
#version 330 core
layout (location = 0) in vec3 aPos;
layout (location = 1) in vec3 aColor;

out vec3 ourColor;
out vec3 ourPos;
void main(){
	gl_Position = vec4(aPos,1.0);
	ourColor = aColor;
	ourPos = aPos;
}
//片元着色器
#version 330 core
out vec4 FragColor;
in vec3 ourColor;
in vec3 ourPos;

void main(){
	FragColor=vec4(ourPos,1.0);
}
```
*分析*：这一操作实质上是把位置值作为颜色值而输出，根据位置值的定义：

右下是`(0.5f,-0.5f,0.0f)`，当其作为颜色值时，则R=0.5,G=-0.5,B=0.0，由于RGB范围是0-1，所以最终G会被钳制为0，则右下顶点近似于中红。同理，左下是`(-0.5f,-0.5f,0.0f)`，RG分量都被钳制为0，所有分量都是0，则为黑色。中上是`(0.0f,0.5f,0.0f)`，是中绿。

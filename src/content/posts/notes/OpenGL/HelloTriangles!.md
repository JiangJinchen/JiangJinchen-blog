---
title: Hello,Triangles!
published: 2026-06-21
description: 'Learn OpenGL 第一章第四节'
image: ''
tags: [OpenGL]
category: '学习笔记/OpenGL'
draft: false 
lang: 'zh'
---
# VBO / VAO / EBO 详解
## 1.VBO：vertex buffer object
在GPU中开辟一块内存空间，把CPU端的顶点数组，完整拷贝到这块显存里。后续绘制时，GPU直接读显存，不用反复从CPU拿数据，效率高。

VBO是一个数组，存储一长串数字，可以是位置、颜色、纹理坐标、法向量等等，但是它并不知道哪些元素对应位置、哪些元素对应颜色，所以需要显式指定。

### OpenGL使用步骤
1. 定义顶点数据：
```c
float vertices[] = {
    -0.5f, -0.5f, 0.0f,
     0.5f, -0.5f, 0.0f,
     0.0f,  0.5f, 0.0f
};
```
2. 创建VBO对象：
```c
unsigned int VBO;
glGenBuffers(1,&VBO);//生成一个VBO，相当于申请一块显存
```
3. 绑定VBO对象：
```c
glBindBuffer(GL_ARRAY_BUFFER,VBO);//GL_ARRAY_BUFFER是顶点缓冲对象的类型，相当于把这块显存标记为顶点数据缓冲
```
4. 传递顶点数据：
```c
glBufferData(GL_ARRAY_BUFFER,sizeof(vertices),vertices,GL_STATIC_DRAW);//把CPU上的顶点数组复制到GPU的VBO里
```

## 2.VAO：vertex array object
状态容器，记录绘制顶点时所需的全部配置，是VBO的读取规则。内部存有若干条（最多16条，0-15）attribute pointer，每个pointer代表一个顶点属性（位置、颜色等），对应使用`glVertexAttribPointer`设置的读取规则。

每个规则包含的信息（也就是`glVertexAttribPointer`的6个参数）：
1. index：属性索引，在定义顶点属性时用`Layout(location=xx)`声明的这个属性的编号（比如0就是位置，1就是颜色）
2. size：分量数，对应这个属性的数据类型的分量数，比如vec3对应size=3
3. type：数据类型，比如GL_FLOAT和GL_INT等
4. normalized：是否归一化，GL_TRUE或者GL_FALSE，无符号类型的数据会被归一化到0-1，有符号类型的数据会被归一化到-1-1
5. stride：步长，在VBO中，同一个属性，第一个值到第二个值之间的字节数
6. pointer：偏移量，从VBO的第几个字节开始读这个属性

这六个参数会完整的存在VAO的一条attribute pointer中，表明从当前VBO（当前 GL_ARRAY_BUFFER 绑定的 VBO）中读取当前属性的规则。

VAO中还存储了当前绑定的EBO的ID

### OpenGL使用步骤
1. 创建VAO：
```c
unsigned int VAO;
glGenVertexArrays(1,&VAO);
```
2. 绑定VAO：标识开始记录配置
```c
glBindVertexArray(VAO);
```
3. 配置VBO、EBO、顶点属性：
```c
glBindBuffer(GL_ARRAY_BUFFER,VBO);
glBindBuffer(GL_ELEMENT_BUFFER,EBO);
glVertexAttribPointer(...);
glEnableVertexAttribArray(0);
```
4. 调用VAO绘制：
```c
glBindVertexArray(VAO);
glDrawElements(...);
```

## 3.EBO：elment buffer object
一个顶点序号数组，表示顶点绘制顺序。实现顶点复用，减少存储开销。

### OpenGL使用步骤
1. 定义索引数组：
```c
unsigned int indices[] = {0,1,2,0,2,3};
```
2. 创建EBO：
```c
unsigned int EBO;
glGenBuffers(1,&EBO);
```
3. 绑定EBO（需要在绑定VAO之后，这样VAO会自动记录这个EBO的ID，调用VAO进行绘制时才能找到对应的EBO）：
```c
glBindBuffer(GL_ELEMENT_ARRAY_BUFFER,EBO);
```
4. 传递索引数据：
```c
glBufferData(GL_ELEMENT_ARRAY_BUFFER,sizeof(indices),indices,GL_STATIC_DRAW);
```
5. 调用VAO绘制：
```c
glBindVertexArray(VAO);
glDrawElements(GL_TRIANGLES,6,GL_UNSIGNED_INT,0);
//第一个参数是绘制模式，第二个参数是绘制顶点数，第三个参数是索引类型，第四个参数是要读取的第一个数在EBO中的偏移。
//GPU从VAO中找到VBO，读取索引，按索引去VAO中找顶点，绘制。
```

# 第一份完整的OpenGL程序
```c
//first part: 头文件
#include <glad/glad.h>//帮助找到OpenGL的位置，以便可以使用OpenGL函数
#include <GLFW/glfw3.h>//GLFW库能够创建窗口、处理鼠标键盘输入
#include <iostream>//可以使用cin、cout等函数

using namespace std;

//second part: 函数定义
//回调函数
//当某些事件被触发，这些函数会被自动调用（怎么判定事件发生？用户操作触发事件，操作系统给GLFW发消息，GLFW收到后，自动调用写的回调函数）
//编写格式：
/*
	void 函数名（GLFWwindow* window,其他参数)
	{
		逻辑代码
	}
*/
//当窗口大小改变时，GLFW自动调用这个函数，让画面自适应窗口大小。传入的width和height就是改变后的窗口大小
void framebuffer_size_callback(GLFWwindow* window, int width, int height) {
	glViewport(0, 0, width, height);//设置OpenGL画图的区域。(0,0)是绘图区域的原点，是左下角
};
//工具函数定义
void processInput(GLFWwindow* window) {//传入指向窗口对象的指针，表示要处理哪个窗口的输入
	if (glfwGetKey(window, GLFW_KEY_ESCAPE) == GLFW_PRESS) {
		glfwSetWindowShouldClose(window, true);//表示这个窗口可以关闭了
	}
}

//third part: 窗口大小设置
const unsigned int SCR_WIDTH = 800;
const unsigned int SCR_HEIGHT = 600;

//fourth part: 着色器源码
//使用const char* ：着色器源码是一段字符串，传给GPU编译
const char* vertexShaderSource = "#version 330 core\n"
"layout (location = 0) in vec3 aPos;\n"
"void main()\n"
"{\n"
"	gl_Position = vec4(aPos,1.0);\n"
"}\n\0";//注意有一个字符结束符

const char* fragmentShaderSource = "#version 330 core\n"
"out vec4 FragColor;\n"
"void main()\n"
"{\n"
"	FragColor = vec4(1.0,0.5,0.2,1.0);\n"
"}\n\0";

//fifth part: 主函数入口、程序入口
int main() {
	//first task: 初始化GLFW
	//怎么理解这四行函数以及重复出现的glfwWindowHint
	glfwInit();
	glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 3);//主版本
	glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 3);//次版本。合起来就是要使用OpenGL3.3
	glfwWindowHint(GLFW_OPENGL_PROFILE, GLFW_OPENGL_CORE_PROFILE);//核心模式

	//second task: 创建窗口
	GLFWwindow* window = glfwCreateWindow(SCR_WIDTH, SCR_HEIGHT, "LearnOpenGL", NULL, NULL);
	if (window == NULL) {
		cout << "Failed to create GLFW window" << endl;
		glfwTerminate();
		return -1;
	}
	//窗口相关设置
	glfwMakeContextCurrent(window);//把当前窗口设置为OpenGL绘图上下文
	glfwSetFramebufferSizeCallback(window, framebuffer_size_callback);//注册窗口大小变化回调
	//为什么需要注册这个回调？告诉GLFW当窗口大小变了之后，调用这个函数

	//third task: 初始化GLAD
	//OPENGL存在显卡驱动里，每个显卡位置不一样，GLAD负责找到所有OpenGL函数的地址
	if (!gladLoadGLLoader((GLADloadproc)glfwGetProcAddress))
	{
		cout << "Failed to initialize GLAD" << endl;
		return -1;
	}

	//fourth task: 着色器相关
	//顶点着色器
	//创建顶点着色器
	unsigned int vertexShader = glCreateShader(GL_VERTEX_SHADER);
	//把源码绑定到顶点着色器
	glShaderSource(vertexShader, 1, &vertexShaderSource, NULL);//四个参数：着色器参数、源码字符串数量、源码字符串地址、长度（NULL=自动计算）
	//编译
	glCompileShader(vertexShader);
	//检查着色器是否编译成功
	int success;
	char infoLog[512];
	glGetShaderiv(vertexShader, GL_COMPILE_STATUS, &success);//三个参数：哪个着色器、问什么状态、结果存到哪里。成功：success=1，失败success=0
	if (!success) {
		glGetShaderInfoLog(vertexShader, 512, NULL, infoLog);//四个形参：着色器、日志大小、NULL、存日志的数组。如果编译失败，给出日志
		cout << "ERROR::SHADER::VERTEX::COMPILATION FAILED\n" << infoLog << endl;
	}

	//片元着色器
	unsigned int fragmentShader = glCreateShader(GL_FRAGMENT_SHADER);
	glShaderSource(fragmentShader, 1, &fragmentShaderSource, NULL);
	glCompileShader(fragmentShader);
	glGetShaderiv(fragmentShader, GL_COMPILE_STATUS, &success);
	if (!success) {
		glGetShaderInfoLog(fragmentShader, 512, NULL, infoLog);
		cout << "ERROR::SHADER::FRAGMENT::COMPILATION_FAILED\n" << infoLog << endl;
	}
	
	//创建着色器程序
	unsigned int shaderProgram = glCreateProgram();
	//附加着色器
	glAttachShader(shaderProgram, vertexShader);
	glAttachShader(shaderProgram, fragmentShader);
	//链接着色器
	glLinkProgram(shaderProgram);
	//检查链接是否成功
	glGetProgramiv(shaderProgram, GL_LINK_STATUS, &success);
	if (!success) {
		glGetProgramInfoLog(shaderProgram, 512, NULL, infoLog);
		cout << "ERROR::SHADER::PROGRAM::LINKING_FAILED\n" << infoLog << endl;
	}
	//删除着色器（为什么可以删除了？编译好的Shader已经复制到shaderProgram中了，原来的Shader就没用了，删除可以省内存）
	glDeleteShader(vertexShader);
	glDeleteShader(fragmentShader);

	//fifth task: 定义顶点数据和索引数组
	//如果定义了索引数组，顶点数据就可以简洁而不重复的定义了
	float vertices[] = {
		0.5f,0.5f,0.0f,//右上
		0.5f,-0.5f,0.0f,//右下
		-0.5f,-0.5f,0.0f,//左下
		-0.5f,0.5f,0.0f//左上
	};
	unsigned int indices[] = {
		0,1,3,
		1,2,3
	};
	
	//sixth task: 定义VBO、EBO、VAO对象
	unsigned int VBO, VAO, EBO;
	//seventh task: 生成VBO、EBO、VAO对象
	glGenVertexArrays(1, &VAO);//1表示生成多少个VAO对象
	glGenBuffers(1, &VBO);
	glGenBuffers(1, &EBO);
	//怎么理解上述创建三个对象使用了不同的创建函数？
	//VAO是状态记录器，VBO和EBO需要存数据

	//eigth task: 绑定VAO，开始配置VBO和EBO的属性
	glBindVertexArray(VAO);
	//ninth task: 绑定VBO，传递数据
	glBindBuffer(GL_ARRAY_BUFFER, VBO);
	glBufferData(GL_ARRAY_BUFFER, sizeof(vertices), vertices, GL_STATIC_DRAW);

	//tenth task: 绑定EBO，传递数据
	glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, EBO);
	glBufferData(GL_ELEMENT_ARRAY_BUFFER, sizeof(indices), indices, GL_STATIC_DRAW);

	//eleven th task: 设置顶点属性
	glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 3 * sizeof(float), (void*)0);
	//并启用
	glEnableVertexAttribArray(0);//这里的0和顶点着色器里的layout (location=0)对应，表示第0号属性

	//twelve th task: 解绑（已经设置完顶点属性了）
	//解绑VBO
	glBindBuffer(GL_ARRAY_BUFFER, 0);
	//解绑VAO
	glBindVertexArray(0);

	//13 th task: 渲染循环
	while (!glfwWindowShouldClose(window)) {
		//输出处理
		processInput(window);

		//清屏
		//设置清屏状态
		glClearColor(0.2f, 0.3f, 0.3f, 1.0f);
		glClear(GL_COLOR_BUFFER_BIT);//清空颜色缓冲，把屏幕涂成glClearColor设置的颜色

		//调用着色器程序
		glUseProgram(shaderProgram);
		//绑定VAO（设置状态）
		glBindVertexArray(VAO);
		//画图
		glDrawElements(GL_TRIANGLES, 6, GL_UNSIGNED_INT, 0);
		//glDrawArrays(GL_TRIANGLES, 0, 6);

		//交换缓冲
		glfwSwapBuffers(window);
		//收集事件并更新相关状态
		glfwPollEvents();
	}
	//14 th task: 释放掉所有创建的
	glDeleteVertexArrays(1, &VAO);
	glDeleteBuffers(1, &VBO);
	glDeleteBuffers(1, &EBO);
	glDeleteProgram(shaderProgram);

	//15 th task: 退出
	glfwTerminate();
	return 0;
}

```

# homework1
添加更多顶点到数据中，使用glDrawArrays，尝试绘制两个彼此相连的三角形。

思路：删除indices索引数组的定义，删除EBO的相关逻辑（创建、绑定、传递数据、设置状态、释放等）。在vertices数组中定义两个三角形各三个顶点，共6个顶点的数据，顶点之间有重合，但是保证都能构成三角形。绘制时，删除原来的glDrawElements使用glDrawArrays并传入正确的参数。
![BQACAgUAAyEGAASHRsPbAAEV1VBqN_Uy-621H6m2Xzgf2M6CP2t0wgACsSIAAqOTwVXeFqPa2vv9ITwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEV1VBqN_Uy-621H6m2Xzgf2M6CP2t0wgACsSIAAqOTwVXeFqPa2vv9ITwE.png)
```c
//first part: 头文件
#include <glad/glad.h>//帮助找到OpenGL的位置，以便可以使用OpenGL函数
#include <GLFW/glfw3.h>//GLFW库能够创建窗口、处理鼠标键盘输入
#include <iostream>//可以使用cin、cout等函数

using namespace std;

//second part: 函数定义
//回调函数
//当某些事件被触发，这些函数会被自动调用（怎么判定事件发生？用户操作触发事件，操作系统给GLFW发消息，GLFW收到后，自动调用写的回调函数）
//编写格式：
/*
	void 函数名（GLFWwindow* window,其他参数)
	{
		逻辑代码
	}
*/
//当窗口大小改变时，GLFW自动调用这个函数，让画面自适应窗口大小。传入的width和height就是改变后的窗口大小
void framebuffer_size_callback(GLFWwindow* window, int width, int height) {
	glViewport(0, 0, width, height);//设置OpenGL画图的区域。(0,0)是绘图区域的原点，是左下角
};
//工具函数定义
void processInput(GLFWwindow* window) {//传入指向窗口对象的指针，表示要处理哪个窗口的输入
	if (glfwGetKey(window, GLFW_KEY_ESCAPE) == GLFW_PRESS) {
		glfwSetWindowShouldClose(window, true);//表示这个窗口可以关闭了
	}
}

//third part: 窗口大小设置
const unsigned int SCR_WIDTH = 800;
const unsigned int SCR_HEIGHT = 600;

//fourth part: 着色器源码
//使用const char* ：着色器源码是一段字符串，传给GPU编译
const char* vertexShaderSource = "#version 330 core\n"
"layout (location = 0) in vec3 aPos;\n"
"void main()\n"
"{\n"
"	gl_Position = vec4(aPos,1.0);\n"
"}\n\0";//注意有一个字符结束符

const char* fragmentShaderSource = "#version 330 core\n"
"out vec4 FragColor;\n"
"void main()\n"
"{\n"
"	FragColor = vec4(1.0,0.5,0.2,1.0);\n"
"}\n\0";

//fifth part: 主函数入口、程序入口
int main() {
	//first task: 初始化GLFW
	//怎么理解这四行函数以及重复出现的glfwWindowHint
	glfwInit();
	glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 3);//主版本
	glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 3);//次版本。合起来就是要使用OpenGL3.3
	glfwWindowHint(GLFW_OPENGL_PROFILE, GLFW_OPENGL_CORE_PROFILE);//核心模式

	//second task: 创建窗口
	GLFWwindow* window = glfwCreateWindow(SCR_WIDTH, SCR_HEIGHT, "LearnOpenGL", NULL, NULL);
	if (window == NULL) {
		cout << "Failed to create GLFW window" << endl;
		glfwTerminate();
		return -1;
	}
	//窗口相关设置
	glfwMakeContextCurrent(window);//把当前窗口设置为OpenGL绘图上下文
	glfwSetFramebufferSizeCallback(window, framebuffer_size_callback);//注册窗口大小变化回调
	//为什么需要注册这个回调？告诉GLFW当窗口大小变了之后，调用这个函数

	//third task: 初始化GLAD
	//OPENGL存在显卡驱动里，每个显卡位置不一样，GLAD负责找到所有OpenGL函数的地址
	if (!gladLoadGLLoader((GLADloadproc)glfwGetProcAddress))
	{
		cout << "Failed to initialize GLAD" << endl;
		return -1;
	}

	//fourth task: 着色器相关
	//顶点着色器
	//创建顶点着色器
	unsigned int vertexShader = glCreateShader(GL_VERTEX_SHADER);
	//把源码绑定到顶点着色器
	glShaderSource(vertexShader, 1, &vertexShaderSource, NULL);//四个参数：着色器参数、源码字符串数量、源码字符串地址、长度（NULL=自动计算）
	//编译
	glCompileShader(vertexShader);
	//检查着色器是否编译成功
	int success;
	char infoLog[512];
	glGetShaderiv(vertexShader, GL_COMPILE_STATUS, &success);//三个参数：哪个着色器、问什么状态、结果存到哪里。成功：success=1，失败success=0
	if (!success) {
		glGetShaderInfoLog(vertexShader, 512, NULL, infoLog);//四个形参：着色器、日志大小、NULL、存日志的数组。如果编译失败，给出日志
		cout << "ERROR::SHADER::VERTEX::COMPILATION FAILED\n" << infoLog << endl;
	}

	//片元着色器
	unsigned int fragmentShader = glCreateShader(GL_FRAGMENT_SHADER);
	glShaderSource(fragmentShader, 1, &fragmentShaderSource, NULL);
	glCompileShader(fragmentShader);
	glGetShaderiv(fragmentShader, GL_COMPILE_STATUS, &success);
	if (!success) {
		glGetShaderInfoLog(fragmentShader, 512, NULL, infoLog);
		cout << "ERROR::SHADER::FRAGMENT::COMPILATION_FAILED\n" << infoLog << endl;
	}
	
	//创建着色器程序
	unsigned int shaderProgram = glCreateProgram();
	//附加着色器
	glAttachShader(shaderProgram, vertexShader);
	glAttachShader(shaderProgram, fragmentShader);
	//链接着色器
	glLinkProgram(shaderProgram);
	//检查链接是否成功
	glGetProgramiv(shaderProgram, GL_LINK_STATUS, &success);
	if (!success) {
		glGetProgramInfoLog(shaderProgram, 512, NULL, infoLog);
		cout << "ERROR::SHADER::PROGRAM::LINKING_FAILED\n" << infoLog << endl;
	}
	//删除着色器（为什么可以删除了？编译好的Shader已经复制到shaderProgram中了，原来的Shader就没用了，删除可以省内存）
	glDeleteShader(vertexShader);
	glDeleteShader(fragmentShader);

	//fifth task: 定义顶点数据和索引数组
	//如果定义了索引数组，顶点数据就可以简洁而不重复的定义了
	//如果没有，或者不想使用索引数组和EBO，则需要根据每个三角形实际包含的顶点，定义多个重复的顶点
	float vertices[] = {
		//第一个三角形
		0.5f,0.5f,0.0f,//右上
		0.5f,-0.5f,0.0f,//右下
		-0.5f,-0.5f,0.0f,//左下

		//第二个三角形
		0.5f,0.5f,0.0f,//右上
		-0.5f,0.5f,0.0f,//左上
		-0.5f,-0.5f,0.0f//左下
	};
	unsigned int indices[] = {
		0,1,3,
		1,2,3
	};
	
	//sixth task: 定义VBO、EBO、VAO对象
	unsigned int VBO, VAO, EBO;
	//seventh task: 生成VBO、EBO、VAO对象
	glGenVertexArrays(1, &VAO);//1表示生成多少个VAO对象
	glGenBuffers(1, &VBO);
	glGenBuffers(1, &EBO);
	//怎么理解上述创建三个对象使用了不同的创建函数？
	//VAO是状态记录器，VBO和EBO需要存数据

	//eigth task: 绑定VAO，开始配置VBO和EBO的属性
	glBindVertexArray(VAO);
	//ninth task: 绑定VBO，传递数据
	glBindBuffer(GL_ARRAY_BUFFER, VBO);
	glBufferData(GL_ARRAY_BUFFER, sizeof(vertices), vertices, GL_STATIC_DRAW);

	//tenth task: 绑定EBO，传递数据
	glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, EBO);
	glBufferData(GL_ELEMENT_ARRAY_BUFFER, sizeof(indices), indices, GL_STATIC_DRAW);

	//eleven th task: 设置顶点属性
	glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 3 * sizeof(float), (void*)0);
	//并启用
	glEnableVertexAttribArray(0);//这里的0和顶点着色器里的layout (location=0)对应，表示第0号属性

	//twelve th task: 解绑（已经设置完顶点属性了）
	//解绑VBO
	glBindBuffer(GL_ARRAY_BUFFER, 0);
	//解绑VAO
	glBindVertexArray(0);

	//以线框模式绘制
	glPolygonMode(GL_FRONT_AND_BACK, GL_LINE);

	//13 th task: 渲染循环
	while (!glfwWindowShouldClose(window)) {
		//输出处理
		processInput(window);

		//清屏
		//设置清屏状态
		glClearColor(0.2f, 0.3f, 0.3f, 1.0f);
		glClear(GL_COLOR_BUFFER_BIT);//清空颜色缓冲，把屏幕涂成glClearColor设置的颜色

		//调用着色器程序
		glUseProgram(shaderProgram);
		//绑定VAO（设置状态）
		glBindVertexArray(VAO);
		//画图
		//glDrawElements(GL_TRIANGLES, 6, GL_UNSIGNED_INT, 0);
		glDrawArrays(GL_TRIANGLES, 0, 6);

		//交换缓冲
		glfwSwapBuffers(window);
		//收集事件并更新相关状态
		glfwPollEvents();
	}
	//14 th task: 释放掉所有创建的
	glDeleteVertexArrays(1, &VAO);
	glDeleteBuffers(1, &VBO);
	glDeleteBuffers(1, &EBO);
	glDeleteProgram(shaderProgram);

	//15 th task: 退出
	glfwTerminate();
	return 0;
}

```

# homework2
创建相同的两个三角形，但对它们的数据使用不同的VAO和VBO。

思路：依旧保持删除EBO的相关逻辑。定义两份vertices数组，分别对应两个三角形的顶点数据。每一个三角形拥有独立的VAO、VBO对象，拥有独立的绑定和设置状态的逻辑，拥有独立的渲染绘制逻辑。
```c
//first part: 头文件
#include <glad/glad.h>//帮助找到OpenGL的位置，以便可以使用OpenGL函数
#include <GLFW/glfw3.h>//GLFW库能够创建窗口、处理鼠标键盘输入
#include <iostream>//可以使用cin、cout等函数

using namespace std;

//second part: 函数定义
//回调函数
//当某些事件被触发，这些函数会被自动调用（怎么判定事件发生？用户操作触发事件，操作系统给GLFW发消息，GLFW收到后，自动调用写的回调函数）
//编写格式：
/*
	void 函数名（GLFWwindow* window,其他参数)
	{
		逻辑代码
	}
*/
//当窗口大小改变时，GLFW自动调用这个函数，让画面自适应窗口大小。传入的width和height就是改变后的窗口大小
void framebuffer_size_callback(GLFWwindow* window, int width, int height) {
	glViewport(0, 0, width, height);//设置OpenGL画图的区域。(0,0)是绘图区域的原点，是左下角
};
//工具函数定义
void processInput(GLFWwindow* window) {//传入指向窗口对象的指针，表示要处理哪个窗口的输入
	if (glfwGetKey(window, GLFW_KEY_ESCAPE) == GLFW_PRESS) {
		glfwSetWindowShouldClose(window, true);//表示这个窗口可以关闭了
	}
}

//third part: 窗口大小设置
const unsigned int SCR_WIDTH = 800;
const unsigned int SCR_HEIGHT = 600;

//fourth part: 着色器源码
//使用const char* ：着色器源码是一段字符串，传给GPU编译
const char* vertexShaderSource = "#version 330 core\n"
"layout (location = 0) in vec3 aPos;\n"
"void main()\n"
"{\n"
"	gl_Position = vec4(aPos,1.0);\n"
"}\n\0";//注意有一个字符结束符

const char* fragmentShaderSource = "#version 330 core\n"
"out vec4 FragColor;\n"
"void main()\n"
"{\n"
"	FragColor = vec4(1.0,0.5,0.2,1.0);\n"
"}\n\0";

//fifth part: 主函数入口、程序入口
int main() {
	//first task: 初始化GLFW
	//怎么理解这四行函数以及重复出现的glfwWindowHint
	glfwInit();
	glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 3);//主版本
	glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 3);//次版本。合起来就是要使用OpenGL3.3
	glfwWindowHint(GLFW_OPENGL_PROFILE, GLFW_OPENGL_CORE_PROFILE);//核心模式

	//second task: 创建窗口
	GLFWwindow* window = glfwCreateWindow(SCR_WIDTH, SCR_HEIGHT, "LearnOpenGL", NULL, NULL);
	if (window == NULL) {
		cout << "Failed to create GLFW window" << endl;
		glfwTerminate();
		return -1;
	}
	//窗口相关设置
	glfwMakeContextCurrent(window);//把当前窗口设置为OpenGL绘图上下文
	glfwSetFramebufferSizeCallback(window, framebuffer_size_callback);//注册窗口大小变化回调
	//为什么需要注册这个回调？告诉GLFW当窗口大小变了之后，调用这个函数

	//third task: 初始化GLAD
	//OPENGL存在显卡驱动里，每个显卡位置不一样，GLAD负责找到所有OpenGL函数的地址
	if (!gladLoadGLLoader((GLADloadproc)glfwGetProcAddress))
	{
		cout << "Failed to initialize GLAD" << endl;
		return -1;
	}

	//fourth task: 着色器相关
	//顶点着色器
	//创建顶点着色器
	unsigned int vertexShader = glCreateShader(GL_VERTEX_SHADER);
	//把源码绑定到顶点着色器
	glShaderSource(vertexShader, 1, &vertexShaderSource, NULL);//四个参数：着色器参数、源码字符串数量、源码字符串地址、长度（NULL=自动计算）
	//编译
	glCompileShader(vertexShader);
	//检查着色器是否编译成功
	int success;
	char infoLog[512];
	glGetShaderiv(vertexShader, GL_COMPILE_STATUS, &success);//三个参数：哪个着色器、问什么状态、结果存到哪里。成功：success=1，失败success=0
	if (!success) {
		glGetShaderInfoLog(vertexShader, 512, NULL, infoLog);//四个形参：着色器、日志大小、NULL、存日志的数组。如果编译失败，给出日志
		cout << "ERROR::SHADER::VERTEX::COMPILATION FAILED\n" << infoLog << endl;
	}

	//片元着色器
	unsigned int fragmentShader = glCreateShader(GL_FRAGMENT_SHADER);
	glShaderSource(fragmentShader, 1, &fragmentShaderSource, NULL);
	glCompileShader(fragmentShader);
	glGetShaderiv(fragmentShader, GL_COMPILE_STATUS, &success);
	if (!success) {
		glGetShaderInfoLog(fragmentShader, 512, NULL, infoLog);
		cout << "ERROR::SHADER::FRAGMENT::COMPILATION_FAILED\n" << infoLog << endl;
	}
	
	//创建着色器程序
	unsigned int shaderProgram = glCreateProgram();
	//附加着色器
	glAttachShader(shaderProgram, vertexShader);
	glAttachShader(shaderProgram, fragmentShader);
	//链接着色器
	glLinkProgram(shaderProgram);
	//检查链接是否成功
	glGetProgramiv(shaderProgram, GL_LINK_STATUS, &success);
	if (!success) {
		glGetProgramInfoLog(shaderProgram, 512, NULL, infoLog);
		cout << "ERROR::SHADER::PROGRAM::LINKING_FAILED\n" << infoLog << endl;
	}
	//删除着色器（为什么可以删除了？编译好的Shader已经复制到shaderProgram中了，原来的Shader就没用了，删除可以省内存）
	glDeleteShader(vertexShader);
	glDeleteShader(fragmentShader);

	//fifth task: 定义顶点数据和索引数组
	//如果定义了索引数组，顶点数据就可以简洁而不重复的定义了
	//如果没有，或者不想使用索引数组和EBO，则需要根据每个三角形实际包含的顶点，定义多个重复的顶点
	float vertices_tri1[] = {
		//第一个三角形
		0.5f,0.5f,0.0f,//右上
		0.5f,-0.5f,0.0f,//右下
		-0.5f,-0.5f,0.0f,//左下
	};

	float vertices_tri2[] = {
		//第二个三角形
		0.5f,0.5f,0.0f,//右上
		-0.5f,0.5f,0.0f,//左上
		-0.5f,-0.5f,0.0f//左下
	};
	
	//sixth task: 定义VBO、VAO对象
	//第一个三角形
	unsigned int VBO1, VAO1;

	//第二个三角形
	unsigned int VBO2, VAO2;

	//seventh task: 生成VBO、VAO对象
	//第一个三角形
	glGenVertexArrays(1, &VAO1);//1表示生成多少个VAO对象
	glGenBuffers(1, &VBO1);


	//第二个三角形
	glGenVertexArrays(1, &VAO2);
	glGenBuffers(1, &VBO2);
	//怎么理解上述创建三个对象使用了不同的创建函数？
	//VAO是状态记录器，VBO和EBO需要存数据

	//eigth task: 绑定VAO，开始配置VBO的属性
	//第一个三角形
	glBindVertexArray(VAO1);
	//ninth task: 绑定VBO，传递数据
	glBindBuffer(GL_ARRAY_BUFFER, VBO1);
	glBufferData(GL_ARRAY_BUFFER, sizeof(vertices_tri1), vertices_tri1, GL_STATIC_DRAW);

	//eleven th task: 设置顶点属性
	glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 3 * sizeof(float), (void*)0);
	//并启用
	glEnableVertexAttribArray(0);//这里的0和顶点着色器里的layout (location=0)对应，表示第0号属性

	//twelve th task: 解绑（已经设置完顶点属性了）
	//解绑VBO
	glBindBuffer(GL_ARRAY_BUFFER, 0);
	//解绑VAO
	glBindVertexArray(0);

	//第二个三角形
	glBindVertexArray(VAO2);
	glBindBuffer(GL_ARRAY_BUFFER, VBO2);
	glBufferData(GL_ARRAY_BUFFER, sizeof(vertices_tri2), vertices_tri2, GL_STATIC_DRAW);
	glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 3 * sizeof(float), (void*)0);
	glEnableVertexAttribArray(0);
	glBindBuffer(GL_ARRAY_BUFFER, 0);
	glBindVertexArray(0);

	//以线框模式绘制
	glPolygonMode(GL_FRONT_AND_BACK, GL_LINE);

	//13 th task: 渲染循环
	while (!glfwWindowShouldClose(window)) {
		//输出处理
		processInput(window);

		//清屏
		//设置清屏状态
		glClearColor(0.2f, 0.3f, 0.3f, 1.0f);
		glClear(GL_COLOR_BUFFER_BIT);//清空颜色缓冲，把屏幕涂成glClearColor设置的颜色

		//调用着色器程序
		glUseProgram(shaderProgram);

		//画第一个三角形
		//绑定VAO1（设置状态）
		glBindVertexArray(VAO1);
		//画图
		//glDrawElements(GL_TRIANGLES, 6, GL_UNSIGNED_INT, 0);
		glDrawArrays(GL_TRIANGLES, 0, 3);

		//画第二个三角形
		glBindVertexArray(VAO2);
		glDrawArrays(GL_TRIANGLES, 0, 3);

		//交换缓冲
		glfwSwapBuffers(window);
		//收集事件并更新相关状态
		glfwPollEvents();
	}
	//14 th task: 释放掉所有创建的
	glDeleteVertexArrays(1, &VAO1);
	glDeleteVertexArrays(1, &VAO2);
	glDeleteBuffers(1, &VBO1);
	glDeleteBuffers(1, &VBO2);
	glDeleteProgram(shaderProgram);

	//15 th task: 退出
	glfwTerminate();
	return 0;
}
```

# homework3
创建两个着色器程序，第二个程序使用一个不同的片段着色器，输出黄色；再次绘制这两个三角形，让其中一个输出为黄色。

思路：首先编写第二个片元着色器，在main中让FragColor输出为黄色（红+绿）；然后创建第二个片元着色器、编译。（无需创建两个一样的顶点着色器，一个顶点着色器可以参与到多个着色器程序，但是第一个着色器定义链接完之后，不能删除了顶点着色器，因为第二个着色器程序还需要用）。接着创建第二个着色器程序，附加顶点着色器、第二个片元着色器，链接顶点着色器和第二个片元着色器。链接完毕后，可以删除顶点着色器和第二个片元着色器。在渲染循环中，分两次画，分别绘制第一和第二个三角形，分别激活第一和第二个着色器程序。
![BQACAgUAAyEGAASHRsPbAAEV1VdqN_W0bYdg1F7sHttWzXlTzHAauQACuSIAAqOTwVVaQxjcIlyQ6DwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEV1VdqN_W0bYdg1F7sHttWzXlTzHAauQACuSIAAqOTwVVaQxjcIlyQ6DwE.png)
```c
//first part: 头文件
#include <glad/glad.h>//帮助找到OpenGL的位置，以便可以使用OpenGL函数
#include <GLFW/glfw3.h>//GLFW库能够创建窗口、处理鼠标键盘输入
#include <iostream>//可以使用cin、cout等函数

using namespace std;

//second part: 函数定义
//回调函数
//当某些事件被触发，这些函数会被自动调用（怎么判定事件发生？用户操作触发事件，操作系统给GLFW发消息，GLFW收到后，自动调用写的回调函数）
//编写格式：
/*
	void 函数名（GLFWwindow* window,其他参数)
	{
		逻辑代码
	}
*/
//当窗口大小改变时，GLFW自动调用这个函数，让画面自适应窗口大小。传入的width和height就是改变后的窗口大小
void framebuffer_size_callback(GLFWwindow* window, int width, int height) {
	glViewport(0, 0, width, height);//设置OpenGL画图的区域。(0,0)是绘图区域的原点，是左下角
};
//工具函数定义
void processInput(GLFWwindow* window) {//传入指向窗口对象的指针，表示要处理哪个窗口的输入
	if (glfwGetKey(window, GLFW_KEY_ESCAPE) == GLFW_PRESS) {
		glfwSetWindowShouldClose(window, true);//表示这个窗口可以关闭了
	}
}

//third part: 窗口大小设置
const unsigned int SCR_WIDTH = 800;
const unsigned int SCR_HEIGHT = 600;

//fourth part: 着色器源码
//使用const char* ：着色器源码是一段字符串，传给GPU编译
const char* vertexShaderSource = "#version 330 core\n"
"layout (location = 0) in vec3 aPos;\n"
"void main()\n"
"{\n"
"	gl_Position = vec4(aPos,1.0);\n"
"}\n\0";//注意有一个字符结束符

//第一个片元着色器
const char* fragmentShaderSource = "#version 330 core\n"
"out vec4 FragColor;\n"
"void main()\n"
"{\n"
"	FragColor = vec4(1.0,0.5,0.2,1.0);\n"
"}\n\0";

//第二个片元着色器
const char* fragmentShaderSource2 = "#version 330 core\n"
"out vec4 FragColor;\n"
"void main()\n"
"{\n"
"	FragColor = vec4(1.0,1.0,0,1.0);\n"
"}\n\0";

//fifth part: 主函数入口、程序入口
int main() {
	//first task: 初始化GLFW
	//怎么理解这四行函数以及重复出现的glfwWindowHint
	glfwInit();
	glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 3);//主版本
	glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 3);//次版本。合起来就是要使用OpenGL3.3
	glfwWindowHint(GLFW_OPENGL_PROFILE, GLFW_OPENGL_CORE_PROFILE);//核心模式

	//second task: 创建窗口
	GLFWwindow* window = glfwCreateWindow(SCR_WIDTH, SCR_HEIGHT, "LearnOpenGL", NULL, NULL);
	if (window == NULL) {
		cout << "Failed to create GLFW window" << endl;
		glfwTerminate();
		return -1;
	}
	//窗口相关设置
	glfwMakeContextCurrent(window);//把当前窗口设置为OpenGL绘图上下文
	glfwSetFramebufferSizeCallback(window, framebuffer_size_callback);//注册窗口大小变化回调
	//为什么需要注册这个回调？告诉GLFW当窗口大小变了之后，调用这个函数

	//third task: 初始化GLAD
	//OPENGL存在显卡驱动里，每个显卡位置不一样，GLAD负责找到所有OpenGL函数的地址
	if (!gladLoadGLLoader((GLADloadproc)glfwGetProcAddress))
	{
		cout << "Failed to initialize GLAD" << endl;
		return -1;
	}

	//fourth task: 着色器相关
	//顶点着色器
	//创建顶点着色器
	unsigned int vertexShader = glCreateShader(GL_VERTEX_SHADER);
	//把源码绑定到顶点着色器
	glShaderSource(vertexShader, 1, &vertexShaderSource, NULL);//四个参数：着色器参数、源码字符串数量、源码字符串地址、长度（NULL=自动计算）
	//编译
	glCompileShader(vertexShader);
	//检查着色器是否编译成功
	int success;
	char infoLog[512];
	glGetShaderiv(vertexShader, GL_COMPILE_STATUS, &success);//三个参数：哪个着色器、问什么状态、结果存到哪里。成功：success=1，失败success=0
	if (!success) {
		glGetShaderInfoLog(vertexShader, 512, NULL, infoLog);//四个形参：着色器、日志大小、NULL、存日志的数组。如果编译失败，给出日志
		cout << "ERROR::SHADER::VERTEX::COMPILATION FAILED\n" << infoLog << endl;
	}

	//片元着色器
	//第一个片元着色器
	unsigned int fragmentShader = glCreateShader(GL_FRAGMENT_SHADER);
	glShaderSource(fragmentShader, 1, &fragmentShaderSource, NULL);
	glCompileShader(fragmentShader);
	glGetShaderiv(fragmentShader, GL_COMPILE_STATUS, &success);
	if (!success) {
		glGetShaderInfoLog(fragmentShader, 512, NULL, infoLog);
		cout << "ERROR::SHADER::FRAGMENT::COMPILATION_FAILED\n" << infoLog << endl;
	}

	//第二个片元着色器
	unsigned int fragmentShader2 = glCreateShader(GL_FRAGMENT_SHADER);
	glShaderSource(fragmentShader2, 1, &fragmentShaderSource2, NULL);
	glCompileShader(fragmentShader2);
	glGetShaderiv(fragmentShader2, GL_COMPILE_STATUS, &success);
	if (!success) {
		glGetShaderInfoLog(fragmentShader2, 512, NULL, infoLog);
		cout << "ERROR::SHADER::FRAGMENT::COMPILATION_FAILED\n" << infoLog << endl;
	}
	
	//创建着色器程序
	//第一个着色器程序
	unsigned int shaderProgram = glCreateProgram();
	//附加着色器
	glAttachShader(shaderProgram, vertexShader);
	glAttachShader(shaderProgram, fragmentShader);
	//链接着色器
	glLinkProgram(shaderProgram);
	//检查链接是否成功
	glGetProgramiv(shaderProgram, GL_LINK_STATUS, &success);
	if (!success) {
		glGetProgramInfoLog(shaderProgram, 512, NULL, infoLog);
		cout << "ERROR::SHADER::PROGRAM::LINKING_FAILED\n" << infoLog << endl;
	}
	//删除着色器（为什么可以删除了？编译好的Shader已经复制到shaderProgram中了，原来的Shader就没用了，删除可以省内存）
	glDeleteShader(fragmentShader);//只能先删fragmentShader，vertexShader第二个着色器程序还需要用

	//第二个着色器程序
	unsigned int shaderProgram2 = glCreateProgram();
	glAttachShader(shaderProgram2, vertexShader);
	glAttachShader(shaderProgram2, fragmentShader2);
	glLinkProgram(shaderProgram2);
	glGetProgramiv(shaderProgram2, GL_LINK_STATUS, &success);
	if (!success) {
		glGetProgramInfoLog(shaderProgram2, 512, NULL, infoLog);
		cout << "ERROR::SHADER::PROGRAM::LINKING_FAILED\n" << infoLog << endl;
	}
	glDeleteShader(vertexShader);
	glDeleteShader(fragmentShader2);

	//fifth task: 定义顶点数据和索引数组
	//如果定义了索引数组，顶点数据就可以简洁而不重复的定义了
	//如果没有，或者不想使用索引数组和EBO，则需要根据每个三角形实际包含的顶点，定义多个重复的顶点
	float vertices_tri1[] = {
		//第一个三角形
		0.5f,0.5f,0.0f,//右上
		0.5f,-0.5f,0.0f,//右下
		-0.5f,-0.5f,0.0f,//左下
	};

	float vertices_tri2[] = {
		//第二个三角形
		0.5f,0.5f,0.0f,//右上
		-0.5f,0.5f,0.0f,//左上
		-0.5f,-0.5f,0.0f//左下
	};
	
	//sixth task: 定义VBO、VAO对象
	//第一个三角形
	unsigned int VBO1, VAO1;

	//第二个三角形
	unsigned int VBO2, VAO2;

	//seventh task: 生成VBO、VAO对象
	//第一个三角形
	glGenVertexArrays(1, &VAO1);//1表示生成多少个VAO对象
	glGenBuffers(1, &VBO1);


	//第二个三角形
	glGenVertexArrays(1, &VAO2);
	glGenBuffers(1, &VBO2);
	//怎么理解上述创建三个对象使用了不同的创建函数？
	//VAO是状态记录器，VBO和EBO需要存数据
	
	//上面创建多个VAO和VBO对象还可以使用数组，更为简洁
	//unsigned int VBOs[2],VAOs[2];
	//glGenVertexArrays(2,VAOs);//数组名即是地址
	//glGenBuffers(2,VBOs);
	//使用时是VBOs[0],VBOs[1];VAOs[0],VAOs[1]

	//eigth task: 绑定VAO，开始配置VBO的属性
	//第一个三角形
	glBindVertexArray(VAO1);
	//ninth task: 绑定VBO，传递数据
	glBindBuffer(GL_ARRAY_BUFFER, VBO1);
	glBufferData(GL_ARRAY_BUFFER, sizeof(vertices_tri1), vertices_tri1, GL_STATIC_DRAW);

	//eleven th task: 设置顶点属性
	glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 3 * sizeof(float), (void*)0);
	//并启用
	glEnableVertexAttribArray(0);//这里的0和顶点着色器里的layout (location=0)对应，表示第0号属性

	//twelve th task: 解绑（已经设置完顶点属性了）
	//解绑VBO
	glBindBuffer(GL_ARRAY_BUFFER, 0);
	//解绑VAO
	glBindVertexArray(0);

	//第二个三角形
	glBindVertexArray(VAO2);
	glBindBuffer(GL_ARRAY_BUFFER, VBO2);
	glBufferData(GL_ARRAY_BUFFER, sizeof(vertices_tri2), vertices_tri2, GL_STATIC_DRAW);
	glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 3 * sizeof(float), (void*)0);
	glEnableVertexAttribArray(0);
	glBindBuffer(GL_ARRAY_BUFFER, 0);
	glBindVertexArray(0);

	//13 th task: 渲染循环
	while (!glfwWindowShouldClose(window)) {
		//输出处理
		processInput(window);

		//清屏
		//设置清屏状态
		glClearColor(0.2f, 0.3f, 0.3f, 1.0f);
		glClear(GL_COLOR_BUFFER_BIT);//清空颜色缓冲，把屏幕涂成glClearColor设置的颜色

		//画第一个三角形
		//调用着色器程序
		glUseProgram(shaderProgram);
		//绑定VAO1（设置状态）
		glBindVertexArray(VAO1);
		//画图
		//glDrawElements(GL_TRIANGLES, 6, GL_UNSIGNED_INT, 0);
		glDrawArrays(GL_TRIANGLES, 0, 3);

		//画第二个三角形
		glUseProgram(shaderProgram2);
		glBindVertexArray(VAO2);
		glDrawArrays(GL_TRIANGLES, 0, 3);

		//交换缓冲
		glfwSwapBuffers(window);
		//收集事件并更新相关状态
		glfwPollEvents();
	}
	//14 th task: 释放掉所有创建的
	glDeleteVertexArrays(1, &VAO1);
	glDeleteVertexArrays(1, &VAO2);
	glDeleteBuffers(1, &VBO1);
	glDeleteBuffers(1, &VBO2);
	glDeleteProgram(shaderProgram);
	glDeleteProgram(shaderProgram2);

	//15 th task: 退出
	glfwTerminate();
	return 0;
}
```
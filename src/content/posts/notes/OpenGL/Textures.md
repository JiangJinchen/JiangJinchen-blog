---
title: Textures
published: 2026-06-27
description: 'Learn OpenGL 第一章第六节'
image: ''
tags: [OpenGL]
category: '学习笔记/OpenGL'
draft: false 
lang: 'zh'
---
# 纹理映射原理
纹理映射的核心逻辑：为模型的**每个顶点分配专属纹理坐标**，以此标定该顶点对应纹理图像的采样位置；模型其余未定义纹理坐标的片段，会通过GPU自动插值计算得到对应纹理颜色，最终将2D纹理图像贴合到3D模型表面。

# OpenGL纹理坐标规则
OpenGL 2D纹理图像的坐标系标准：
- **原点位置**：纹理图像左下角
- **X轴**：水平向右为正方向（对应纹理 S 轴）
- **Y轴**：竖直向上为正方向（对应纹理 T 轴）
补充：3D纹理会额外包含 R 轴，构成三维纹理坐标体系。纹理坐标常规取值范围为 `[0, 1]`，超出该范围会触发纹理环绕规则。

# 纹理环绕模式
## 四种环绕模式
当纹理坐标超出 [0, 1] 范围时，OpenGL 会根据配置的环绕方式处理边缘像素，共四种模式：
- **GL_REPEAT（默认）**：重复平铺纹理图像，超出坐标区域直接复刻完整纹理
- **GL_MIRRORED_REPEAT**：镜像重复纹理，相邻的重复纹理呈翻转状态，衔接更自然
- **GL_CLAMP_TO_EDGE**：边缘拉伸约束，将超出范围的纹理坐标约束在 0 和 1，持续复用纹理边缘像素，产生边缘拉伸效果
- **GL_CLAMP_TO_BORDER**：自定义边缘颜色，超出纹理坐标范围的区域显示用户指定的边框颜色

## 代码配置规则
统一使用函数：`glTexParameter*`(纹理目标, 配置选项&坐标轴, 参数值)，函数后缀` * `由参数值类型决定。
### 前三种环绕方式（整型参数，后缀为i）
适用于`GL_REPEAT`、`GL_MIRRORED_REPEAT`、`GL_CLAMP_TO_EDGE`，参数为整型宏：
```c
// 2D纹理，S轴（水平）设置为重复环绕
glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_REPEAT);
// 2D纹理，T轴（竖直）设置为重复环绕
glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_REPEAT);
```
仅需修改最后一个宏参数，即可切换对应环绕模式。
### GL_CLAMP_TO_BORDER（浮点数组参数，后缀为fv）
该模式需要额外自定义纹理边缘颜色，步骤如下：
```c
// 1. 定义RGBA边缘颜色浮点数组
float borderColor[] = {1.0f, 1.0f, 0.0f, 1.0f};
// 2. 设置S、T轴环绕模式为边框约束
glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_BORDER);
glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_BORDER);
// 3. 绑定自定义边缘颜色
glTexParameterfv(GL_TEXTURE_2D, GL_TEXTURE_BORDER_COLOR, borderColor);
```
# 纹理过滤模式
## 过滤原理
纹理坐标是连续浮点值，屏幕像素是离散整型值，当纹理坐标无法精准落在纹理像素中心时，需要通过过滤算法采样像素颜色。主要用于解决**纹理放大/缩小**失真问题：
- **纹理放大**：低分辨率纹理映射到大面积模型
- **纹理缩小**：高分辨率纹理映射到小面积模型
## 两种基础过滤模式
- **GL_NEAREST（最近邻过滤）**：选取纹理坐标中心点最接近的纹理像素，速度快，画面有锯齿、颗粒感明显
- **GL_LINEAR（线性过滤）**：采样纹理坐标周边多个像素，通过线性插值计算最终颜色，画面平滑、无锯齿，开销略高
## 代码配置
```c
// 纹理缩小时：使用最近邻过滤
glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_NEAREST);
// 纹理放大时：使用线性过滤
glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
```

# 多级渐远纹理
## 核心原理
创建基础纹理后，通过`glGenerateMipmap(GL_TEXTURE_2D)` 自动生成一组**分辨率逐级减半**的纹理序列。GPU 根据模型与观察者的距离，自动匹配对应分辨率的纹理：近距离用高清纹理，远距离用低清纹理，在保证画质的同时大幅提升渲染效率。
解决问题：不同层级Mipmap纹理切换时产生的生硬边界、断层闪烁问题。
## Mipmap过滤组合模式
格式：`GL_[纹理采样方式]_MIPMAP_[层级选择方式]`，仅适用于**纹理缩小**场景（MIN_FILTER），放大场景不生效：
- **GL_NEAREST_MIPMAP_NEAREST**：选取最近的Mipmap层级，层级内使用最近邻采样，速度最快、画质最差
- **GL_NEAREST_MIPMAP_LINEAR**：选取相邻两级Mipmap纹理，两级分别最近邻采样后，再对两个结果线性插值
- **GL_LINEAR_MIPMAP_NEAREST**：选取最近的Mipmap层级，层级内使用线性插值采样
- **GL_LINEAR_MIPMAP_LINEAR**：三线性插值，选取相邻两级Mipmap，两级分别线性采样，最终再插值融合，画质最平滑、开销最高
## 代码配置
```c
// 纹理缩小：开启三线性插值Mipmap过滤
glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR_MIPMAP_LINEAR);
// 纹理放大：仅支持基础过滤，无Mipmap效果
glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
// 生成多级渐远纹理
glGenerateMipmap(GL_TEXTURE_2D);
```

# 纹理单元与采样器
## 核心概念
- **纹理单元**：GPU硬件级纹理插槽，显卡最多支持 **16个** 纹理单元（索引 0~15），用于绑定、存储纹理资源，是承载纹理的硬件容器
- **采样器（sampler2D）**：着色器中的int型变量，变量值对应纹理单元索引，作用是指定从哪一个纹理单元中采样纹理数据
## 纹理使用流程
1. 激活指定索引的纹理单元；
2. 将纹理对象绑定到当前激活的纹理单元；
3. 着色器采样器关联对应纹理单元索引；
4. 着色器中完成纹理采样渲染。
## 特殊默认规则
**单纹理场景无需手动激活绑定**：
- GPU 默认始终激活 **0号纹理单元**，单纹理绑定会自动挂载到0号单元；
- 着色器中定义的 `sampler2D` 采样器，默认对应0号纹理单元，无需手动链接即可直接使用。

# example1: 创建纹理并使用纹理
*流程*：首先是重要的头文件`<stb_image.h>`的引入，以及相应的编译指令`#define STB_IMAGE_IMPLEMENTATION`；然后在`main`函数中，创建纹理`ID`，绑定纹理目标，设置纹理模式（环绕、过滤）、加载纹理数据、传递纹理数据、生成多级渐远纹理。在`main`函数中的渲染函数中，绑定纹理目标（表示在这一帧中要使用这张纹理画当前这个物体），然后绘制三角形。此外，还需在`vertices`数组中定义第三个顶点属性：纹理坐标，然后在顶点着色器中定义新的输入属性：纹理坐标，将其传递给片元着色器。在片元着色器中，使用`uniform`变量定义一张纹理（`sampler2D`类型），然后使用`texture`函数采样，作为输出颜色。
![BQACAgUAAyEGAASHRsPbAAEWKTBqPzXA6m3LZSiYQBdI2pB4UkJnpQACpCEAAk05AVYqCVG3FoK3EzwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWKTBqPzXA6m3LZSiYQBdI2pB4UkJnpQACpCEAAk05AVYqCVG3FoK3EzwE.png)
```c
#define STB_IMAGE_IMPLEMENTATION//手动告诉编译器，把stb的代码编译进去
//如果没有加上面这一句，编译时不会报错，运行时找不到这个实现，链接报错
#include <glad/glad.h>
#include <GLFW/glfw3.h>
#include <stb_image.h>//这是一个单头文件库，只声明了函数，没实现函数

#include <myShader.h>
#include <iostream>

void framebuffer_size_callback(GLFWwindow* window, int width, int height) {
	glViewport(0, 0, width, height);
}

void processInput(GLFWwindow* window) {
	if (glfwGetKey(window, GLFW_KEY_ESCAPE) == GLFW_PRESS) {
		glfwSetWindowShouldClose(window, true);
	}
}

const int SCR_WIDTH = 800;
const int SCR_HEIGHT = 600;

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
		0.5f,0.5f,0.0f, 1.0f,0.0f,0.0f, 1.0f,1.0f,//右上
		0.5f,-0.5f,0.0f, 0.0f,1.0f,0.0f, 1.0f,0.0f,//右下
		-0.5f,-0.5f,0.0f, 0.0f,0.0f,1.0f, 0.0f,0.0f,//左下
		-0.5f,0.5f,0.0f, 1.0f,1.0f,0.0f, 0.0f,1.0f,//左上
	};
	unsigned int indices[] = {
		0,1,3,
		1,2,3
	};

	unsigned int VBO, VAO, EBO;
	glGenVertexArrays(1, &VAO);
	glGenBuffers(1, &VBO);
	glGenBuffers(1, &EBO);

	glBindVertexArray(VAO);

	glBindBuffer(GL_ARRAY_BUFFER, VBO);
	glBufferData(GL_ARRAY_BUFFER, sizeof(vertices), vertices, GL_STATIC_DRAW);

	glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, EBO);
	glBufferData(GL_ELEMENT_ARRAY_BUFFER, sizeof(indices), indices, GL_STATIC_DRAW);

	glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 8 * sizeof(float), (void*)0);
	glEnableVertexAttribArray(0);
	glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, 8 * sizeof(float), (void*)(3 * sizeof(float)));
	glEnableVertexAttribArray(1);
	glVertexAttribPointer(2, 2, GL_FLOAT, GL_FALSE, 8 * sizeof(float), (void*)(6 * sizeof(float)));
	glEnableVertexAttribArray(2);

	//创建纹理ID
	unsigned int texture;
	//生成纹理ID
	glGenTextures(1, &texture);
	//绑定纹理（将当前要操纵的2D纹理设置为texture这个ID对应的纹理）
	glBindTexture(GL_TEXTURE_2D, texture);
	//设置纹理环绕模式
	glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_REPEAT);
	glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_REPEAT);
	//设置纹理过滤模式
	glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER,GL_LINEAR_MIPMAP_LINEAR);//设置模式和生成MIPMAP之间没有顺序要求，如果没有生成MIPMAP则自动降级到GL_LINEAR
	glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
	//加载纹理贴图
	int width, height, nrChannels;
	unsigned char* data = stbi_load("resources/textures/container.jpg", &width, &height, &nrChannels, 0);//为什么第一个参数需要用getPath函数，以及使用c_str()?
	if (data) {
		//传递图片数据
		glTexImage2D(GL_TEXTURE_2D, 0, GL_RGB, width, height, 0, GL_RGB, GL_UNSIGNED_BYTE, data);//怎么理解这几个形参，两个GL_RGB的区别是什么？
		//生成多级渐远纹理
		glGenerateMipmap(GL_TEXTURE_2D);
	}
	else {
		cout << "Failed to load texture" << endl;
	}
	//已经生成了图片了，可以释放CPU中存储纹理图片数据的这一块内存
	stbi_image_free(data);

	while (!glfwWindowShouldClose(window)) {
		processInput(window);
		glClearColor(0.2f, 0.3f, 0.3f, 1.0f);
		glClear(GL_COLOR_BUFFER_BIT);

		glBindTexture(GL_TEXTURE_2D, texture);//每帧需要重新绑定这一帧需要的纹理
		//绑定纹理和激活Shader以及绑定VAO的顺序无关，只需保证绑定纹理在画三角形之前就可以

		ourShader.use();
		glBindVertexArray(VAO);
		glDrawElements(GL_TRIANGLES, 6, GL_UNSIGNED_INT, 0);//倒数第二个参数是：索引数组中每个元素的类型

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
```glsl
//顶点着色器
#version 330 core
layout (location = 0) in vec3 aPos;
layout (location = 1) in vec3 aColor;
layout (location = 2) in vec2 aTexcoord;

out vec3 ourColor;
out vec3 ourPos;
out vec2 ourTexcoord;
void main(){
	gl_Position = vec4(aPos,1.0);
	ourColor = aColor;
	ourPos = aPos;
	ourTexcoord = aTexcoord;
}
//片元着色器
#version 330 core
out vec4 FragColor;
in vec3 ourColor;
in vec3 ourPos;
in vec2 ourTexcoord;

uniform sampler2D ourTexture;

void main(){
	FragColor=texture(ourTexture,ourTexcoord);
}
```

如果在片元着色器中将纹理颜色和顶点颜色进行混合，即
```glsl
FragColor=texture(ourTexture,ourTexcoord)*vec4(ourColor,1.0);
```
![BQACAgUAAyEGAASHRsPbAAEWKTZqPzYOhymoAQiJxHtxvvGul4QVbAACrCEAAk05AVYGU5h4zD_fEjwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWKTZqPzYOhymoAQiJxHtxvvGul4QVbAACrCEAAk05AVYGU5h4zD_fEjwE.png)

# example2: 使用纹理单元实现更多纹理
纹理单元是GPU上的**纹理插槽**，每个纹理单元管理一张纹理。着色器中通过**采样器**采样纹理，采样器一般定义为`uniform`变量。在C++代码中对其赋值整数，表示对应第几号纹理单元。激活多个纹理单元、定义多个采样器就可以实现多张纹理。
```c
#define STB_IMAGE_IMPLEMENTATION
#include <glad/glad.h>
#include <GLFW/glfw3.h>
#include <stb_image.h>

#include <iostream>

#include <myShader.h>

void framebuffer_size_callback(GLFWwindow* window, int width, int height) {
	glViewport(0, 0, width, height);
}

void processInput(GLFWwindow* window) {
	if (glfwGetKey(window, GLFW_KEY_ESCAPE) == GLFW_PRESS) {
		glfwSetWindowShouldClose(window,true);
	}
}

const unsigned int SCR_WIDTH = 800;
const unsigned int SCR_HEIGHT = 600;

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

	Shader ourShader("src/Shader/vertexShader.txt", "src/Shader/fragmentShader.txt");//路径不需要以/开头，否则是根目录下

	float vertices[] = {
		0.5f,0.5f,0.0f, 1.0f,0.0f,0.0f, 2.0f,2.0f,//右上
		0.5f,-0.5f,0.0f, 0.0f,1.0f,0.0f, 2.0f,0.0f,//右下
		-0.5f,-0.5f,0.0f, 0.0f,0.0f,0.0f, 0.0f,0.0f,//左下
		-0.5f,0.5f,0.0f, 1.0f,1.0f,0.0f, 0.0f,2.0f//左上
	};

	unsigned int indices[] = {
		0,1,3,
		1,2,3
	};

	unsigned int VBO, VAO, EBO;
	glGenVertexArrays(1, &VAO);
	glGenBuffers(1, &VBO);
	glGenBuffers(1, &EBO);

	glBindVertexArray(VAO);
	glBindBuffer(GL_ARRAY_BUFFER, VBO);
	glBufferData(GL_ARRAY_BUFFER, sizeof(vertices), vertices, GL_STATIC_DRAW);
	glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, EBO);
	glBufferData(GL_ELEMENT_ARRAY_BUFFER, sizeof(indices), indices, GL_STATIC_DRAW);

	glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 8 * sizeof(float), (void*)0);
	glEnableVertexAttribArray(0);
	glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, 8 * sizeof(float), (void*)(3 * sizeof(float)));
	glEnableVertexAttribArray(1);
	glVertexAttribPointer(2, 2, GL_FLOAT, GL_FALSE, 8 * sizeof(float), (void*)(6 * sizeof(float)));
	glEnableVertexAttribArray(2);

	glBindVertexArray(0);

	unsigned int texture1, texture2;
	//先处理第一张纹理
	glGenTextures(1, &texture1);
	glBindTexture(GL_TEXTURE_2D, texture1);
	glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_REPEAT);
	glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_REPEAT);
	glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
	glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);

	int width, height, nrChannels;
	stbi_set_flip_vertically_on_load(true);//纹理默认左上角是原点，OpenGL是左下角是原点，所以需要翻转
	//上面的语句声明一次就可以？是的，告诉stb_image库，以后加载图片的时候，都自动上下翻转，设置的是全局状态
	unsigned char* data = stbi_load("resources/textures/container.jpg", &width, &height, &nrChannels, 0);
	if (data) {
		glTexImage2D(GL_TEXTURE_2D, 0, GL_RGB, width, height, 0, GL_RGB, GL_UNSIGNED_BYTE, data);
		glGenerateMipmap(GL_TEXTURE_2D);
	}
	else {
		cout << "Failed to load texture" << endl;
	}
	stbi_image_free(data);

	//再处理第二张纹理
	glGenTextures(1, &texture2);
	glBindTexture(GL_TEXTURE_2D, texture2);
	glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_REPEAT);
	glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_REPEAT);
	glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
	glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);

	data = stbi_load("resources/textures/awesomeface.png", &width, &height, &nrChannels, 0);
	if (data) {
		glTexImage2D(GL_TEXTURE_2D, 0, GL_RGB, width, height, 0, GL_RGBA, GL_UNSIGNED_BYTE, data);
		glGenerateMipmap(GL_TEXTURE_2D);
	}
	else {
		cout << "Failed to load texture" << endl;
	}
	stbi_image_free(data);

	//为什么在渲染循环外而不是循环内写？因为采样器和纹理单元的对应关系在整个循环过程中都不需要变化
	ourShader.use();//设置uniform变量值之前需要激活着色器，表明设置的是哪一个着色器的uniform变量
	ourShader.setInt("texture1", 0);//采样器texture1对应纹理单元0
	ourShader.setInt("texture2", 1);

	while (!glfwWindowShouldClose(window)) {
		processInput(window);
		glClearColor(0.2f, 0.3f, 0.3f, 1.0f);
		glClear(GL_COLOR_BUFFER_BIT);

		//为什么下面这段代码需要写在激活着色器之前？不一定，但必须在绘制之前
		//激活纹理单元
		glActiveTexture(GL_TEXTURE0);
		//绑定纹理到当前纹理目标
		//驱动自动将纹理放入当前激活的纹理单元
		glBindTexture(GL_TEXTURE_2D, texture1);
		//先激活再绑定，绑定的纹理就放哪个单元
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

# homework1
修改片段着色器，**仅**让笑脸图案朝另一个方向看。

*思路*：修改片元着色器中的用作采样的`uv`坐标，朝向另一个方向看等价于将图片左右颠倒，则对`uv`的`u`取反。又因为`OpenGL`仅支持`.x/.y/.z/.w`或者`.r/.g/.b`，不支持`.u/.v`，所以是对`uv`的`x`坐标取反。

*注意*：上述直接取反实现左右翻转的思路仅适用于纹理环绕模式是**repeat**，这样`-x< = >1-x`。所以通用的写法还是`1-x`，保证了`uv`在`[0,1]`，且正确翻转
![BQACAgUAAyEGAASHRsPbAAEWKTdqPza-nXwq3tAd-Jtm3EyOSGCR0AACrSEAAk05AVZ1yRjxnJxQ1TwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWKTdqPza-nXwq3tAd-Jtm3EyOSGCR0AACrSEAAk05AVZ1yRjxnJxQ1TwE.png)
```glsl
#version 330 core
out vec4 FragColor;
in vec3 ourColor;
in vec3 ourPos;
in vec2 ourTexcoord;

uniform sampler2D texture1;
uniform sampler2D texture2;
void main(){
	FragColor=mix(texture(texture1,ourTexcoord),texture(texture2,vec2(1.0-ourTexcoord.x,ourTexcoord.y)),0.2);
}
```
# homework2
尝试用不同的纹理环绕方式，设定一个从`0.0f`到`2.0f`范围内的（而不是原来的`0.0f`到`1.0f`）纹理坐标。试试看能不能在箱子的角落放置4个笑脸。

*思路*：首先修改`vertices`数组中的`uv`坐标，使之在`[0,2]`范围内。然后修改第二张纹理的纹理环绕模式。
```glsl
float vertices[] = {
	0.5f,0.5f,0.0f, 1.0f,0.0f,0.0f, 2.0f,2.0f,//右上
	0.5f,-0.5f,0.0f, 0.0f,1.0f,0.0f, 2.0f,0.0f,//右下
	-0.5f,-0.5f,0.0f, 0.0f,0.0f,0.0f, 0.0f,0.0f,//左下
	-0.5f,0.5f,0.0f, 1.0f,1.0f,0.0f, 0.0f,2.0f//左上
};
```
**GL_REPEAT:**
![BQACAgUAAyEGAASHRsPbAAEWKThqPzcKeMguaVKZtPMNg9R38xLVzQACriEAAk05AVaHVqyH17sxCjwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWKThqPzcKeMguaVKZtPMNg9R38xLVzQACriEAAk05AVaHVqyH17sxCjwE.png)
**GL_MIRRORED_REPEAT：**
![BQACAgUAAyEGAASHRsPbAAEWKTlqPzcyq_-CpcXjpdMCKBwC7GNvbwACsCEAAk05AVbTIhlBIHcUfzwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWKTlqPzcyq_-CpcXjpdMCKBwC7GNvbwACsCEAAk05AVbTIhlBIHcUfzwE.png)
**GL_CLAMP_TO_EDGE：**（延续边缘的纹理，而第二章图片边缘是透明像素）
![BQACAgUAAyEGAASHRsPbAAEWKUxqPzmTlsQUEEOacm30Y4eWUyTQKAACxyEAAk05AVY4YmjxxsAEyDwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWKUxqPzmTlsQUEEOacm30Y4eWUyTQKAACxyEAAk05AVY4YmjxxsAEyDwE.png)
**GL_CLAMP_TO_BORDER：**
```c
glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_BORDER);
glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_BORDER);
float borderColor[] = { 1.0f,1.0f,0.0f,1.0f };
glTexParameterfv(GL_TEXTURE_2D, GL_TEXTURE_BORDER_COLOR, borderColor);
```
![BQACAgUAAyEGAASHRsPbAAEWKU9qPznL7LtPGlUNnbYnOo_zJPaMowACziEAAk05AVaMBxalpxTMgTwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWKU9qPznL7LtPGlUNnbYnOo_zJPaMowACziEAAk05AVaMBxalpxTMgTwE.png)
ST轴不一样，如
```c
glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_BORDER);//水平方向CLAMP_TO_BORDER
glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_REPEAT);//竖直方向REPEAT
float borderColor[] = { 1.0f,1.0f,0.0f,1.0f };
glTexParameterfv(GL_TEXTURE_2D, GL_TEXTURE_BORDER_COLOR, borderColor);
```
![BQACAgUAAyEGAASHRsPbAAEWKVJqPzoRW7NEd-aLmmH4AAH2kJWyJacAAtQhAAJNOQFWKVHpHm9oGOA8BA.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWKVJqPzoRW7NEd-aLmmH4AAH2kJWyJacAAtQhAAJNOQFWKVHpHm9oGOA8BA.png)

# homework3
尝试在矩形上只显示纹理图像的中间一部分，修改纹理坐标，达到能看见单个的像素的效果。尝试使用`GL_NEAREST`的纹理过滤方式让像素显示得更清晰.

*思路*：题目意思是截取纹理图像上的一小块区域，放大贴满整个长方形。由于纹理拉伸，会导致纹理像素化。而使用`GL_NEAREST`的纹理过滤方式会让这种像素化更明显。所以首先修改`vertices`数组中对于纹理坐标的定义，使之仅覆盖原图的一小部分比如`0.4-0.5`，然后将两种纹理的过滤方式都改为`GL_NEAREST`。
![BQACAgUAAyEGAASHRsPbAAEWKVdqPzpRYs2ukbotuy4ouu3VXgKCfwAC2yEAAk05AVbnTVzA1qmd9DwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWKVdqPzpRYs2ukbotuy4ouu3VXgKCfwAC2yEAAk05AVbnTVzA1qmd9DwE.png)

# homework4
使用一个`uniform`变量作为`mix`函数的第三个参数来改变两个纹理可见度，使用上和下键来改变箱子或笑脸的可见度。

*思路*：首先是修改片元着色器，增加`visibility`这个`uniform`变量的定义，并将其作为`mix`的第三个参数。
![BQACAgUAAyEGAASHRsPbAAEWKVxqPzrXzdrHusYdiLhtd9es7BjJewAC4SEAAk05AVaV4TJg9_ygUDwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWKVxqPzrXzdrHusYdiLhtd9es7BjJewAC4SEAAk05AVaV4TJg9_ygUDwE.png)
```glsl
#version 330 core
out vec4 FragColor;
in vec3 ourColor;
in vec3 ourPos;
in vec2 ourTexcoord;

uniform sampler2D texture1;
uniform sampler2D texture2;
uniform float visibility;
void main(){
	FragColor=mix(texture(texture1,ourTexcoord),texture(texture2,ourTexcoord),visibility);
}
```
然后在`main.cpp`中，因为需要在程序运行过程中实时控制图片的可见度，所以需要把设置`uniform`变量的逻辑写在渲染循环内，且在激活了着色器之后。而赋值给这个`uniform`变量的值`mixValue`的计算是通过监听用户上键和下键的按下/松开情况，这部分逻辑可以整合到之前的`processInput`函数中，每次按下上键，`mixValue+=0.001`；每次按下下键，`mixValue-=0.001`。同时需要进行`[0,1]`的截断，因为可见性只可能是这个范围内。

*注意*：增加减少的值特别要小心，之前认为`0.001`太少了，写了`0.01`，发现按一下按键，图片就完全消失或者完全显示了。
```c
#define STB_IMAGE_IMPLEMENTATION
#include <glad/glad.h>
#include <GLFW/glfw3.h>
#include <stb_image.h>

#include <iostream>

#include <myShader.h>

const unsigned int SCR_WIDTH = 800;
const unsigned int SCR_HEIGHT = 600;
float mixValue = 0.2f;

void framebuffer_size_callback(GLFWwindow* window, int width, int height) {
	glViewport(0, 0, width, height);
}

void processInput(GLFWwindow* window) {
	if (glfwGetKey(window, GLFW_KEY_ESCAPE) == GLFW_PRESS) {
		glfwSetWindowShouldClose(window,true);
	}
	if (glfwGetKey(window, GLFW_KEY_UP) == GLFW_PRESS) {
		mixValue += 0.001f;
		if (mixValue > 1.0f)mixValue = 1.0f;
	}
	if (glfwGetKey(window, GLFW_KEY_DOWN) == GLFW_PRESS) {
		mixValue -= 0.001;
		if (mixValue <= 0.0f) {
			mixValue = 0.0f;
		}
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

	Shader ourShader("src/Shader/vertexShader.txt", "src/Shader/fragmentShader.txt");//路径不需要以/开头，否则是根目录下

	float vertices[] = {
		0.5f,0.5f,0.0f, 1.0f,0.0f,0.0f, 1.0f,1.0f,//右上
		0.5f,-0.5f,0.0f, 0.0f,1.0f,0.0f, 1.0f,0.0f,//右下
		-0.5f,-0.5f,0.0f, 0.0f,0.0f,0.0f, 0.0f,0.0f,//左下
		-0.5f,0.5f,0.0f, 1.0f,1.0f,0.0f, 0.0f,1.0f//左上
	};

	unsigned int indices[] = {
		0,1,3,
		1,2,3
	};

	unsigned int VBO, VAO, EBO;
	glGenVertexArrays(1, &VAO);
	glGenBuffers(1, &VBO);
	glGenBuffers(1, &EBO);

	glBindVertexArray(VAO);
	glBindBuffer(GL_ARRAY_BUFFER, VBO);
	glBufferData(GL_ARRAY_BUFFER, sizeof(vertices), vertices, GL_STATIC_DRAW);
	glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, EBO);
	glBufferData(GL_ELEMENT_ARRAY_BUFFER, sizeof(indices), indices, GL_STATIC_DRAW);

	glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 8 * sizeof(float), (void*)0);
	glEnableVertexAttribArray(0);
	glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, 8 * sizeof(float), (void*)(3 * sizeof(float)));
	glEnableVertexAttribArray(1);
	glVertexAttribPointer(2, 2, GL_FLOAT, GL_FALSE, 8 * sizeof(float), (void*)(6 * sizeof(float)));
	glEnableVertexAttribArray(2);

	glBindVertexArray(0);

	unsigned int texture1, texture2;
	//先处理第一张纹理
	glGenTextures(1, &texture1);
	glBindTexture(GL_TEXTURE_2D, texture1);
	glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
	glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
	glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
	glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);

	int width, height, nrChannels;
	stbi_set_flip_vertically_on_load(true);//纹理默认左上角是原点，OpenGL是左下角是原点，所以需要翻转
	//上面的语句声明一次就可以？是的，告诉stb_image库，以后加载图片的时候，都自动上下翻转，设置的是全局状态
	unsigned char* data = stbi_load("resources/textures/container.jpg", &width, &height, &nrChannels, 0);
	if (data) {
		glTexImage2D(GL_TEXTURE_2D, 0, GL_RGB, width, height, 0, GL_RGB, GL_UNSIGNED_BYTE, data);
		glGenerateMipmap(GL_TEXTURE_2D);
	}
	else {
		cout << "Failed to load texture" << endl;
	}
	stbi_image_free(data);

	//再处理第二张纹理
	glGenTextures(1, &texture2);
	glBindTexture(GL_TEXTURE_2D, texture2);
	glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_REPEAT);
	glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_REPEAT);
	glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
	glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);

	data = stbi_load("resources/textures/awesomeface.png", &width, &height, &nrChannels, 0);
	if (data) {
		glTexImage2D(GL_TEXTURE_2D, 0, GL_RGB, width, height, 0, GL_RGBA, GL_UNSIGNED_BYTE, data);
		glGenerateMipmap(GL_TEXTURE_2D);
	}
	else {
		cout << "Failed to load texture" << endl;
	}
	stbi_image_free(data);

	//为什么在渲染循环外而不是循环内写？因为采样器和纹理单元的对应关系在整个循环过程中都不需要变化
	ourShader.use();//设置uniform变量值之前需要激活着色器，表明设置的是哪一个着色器的uniform变量
	ourShader.setInt("texture1", 0);//采样器texture1对应纹理单元0
	ourShader.setInt("texture2", 1);

	while (!glfwWindowShouldClose(window)) {
		processInput(window);
		glClearColor(0.2f, 0.3f, 0.3f, 1.0f);
		glClear(GL_COLOR_BUFFER_BIT);

		//为什么下面这段代码需要写在激活着色器之前？不一定，但必须在绘制之前
		//激活纹理单元
		glActiveTexture(GL_TEXTURE0);
		//绑定纹理到当前纹理目标
		//驱动自动将纹理放入当前激活的纹理单元
		glBindTexture(GL_TEXTURE_2D, texture1);
		//先激活再绑定，绑定的纹理就放哪个单元
		glActiveTexture(GL_TEXTURE1);
		glBindTexture(GL_TEXTURE_2D, texture2);

		ourShader.use();
		ourShader.setFloat("visibility", mixValue);
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


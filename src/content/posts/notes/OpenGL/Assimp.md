---
title: Assimp和网格
published: 2026-06-27
description: 'Learn OpenGL 第三章第一节、第二节'
image: ''
tags: [OpenGL]
category: '学习笔记/OpenGL'
draft: false 
lang: 'zh'
---
# 各类格式的文件存储的信息：
## OBJ：
**几何顶点**：以`v`开头，跟着是`x y z`以及可选的`w`
**纹理坐标**：以`vt`开头，跟着是`u`以及可选的`v`和`w`
**顶点法线**：以`vn`开头，跟着是`x y z`
**面**：以`f`开头，跟着是`顶点1/纹理坐标1/法线1 顶点2/纹理坐标2/法线2……`其中纹理坐标和法线是可选的。如果只有顶点，则格式为`顶点1 顶点2 ……`；如果只有顶点和纹理坐标，则格式为`顶点1/纹理坐标1 顶点2/纹理坐标2……`；如果只有顶点和法线，则格式为`顶点1//法线1 顶点2//法线2……`。面信息中索引都是从`1`开始而非`0`
**线条**：以`l`开头，跟着是`顶点1 顶点2 ……`即构成这条线的顶点的索引
```obj
# 注释：立方体模型
mtllib cube.mtl       # 引用外部材质文件 cube.mtl
o Cube_Object         # 定义物体名
g Cube_Group          # 定义组名
s 1                   # 开启平滑着色

# 1. 几何顶点 v (x y z)
v -0.5 -0.5 -0.5
v  0.5 -0.5 -0.5
v  0.5  0.5 -0.5
v -0.5  0.5 -0.5
v -0.5 -0.5  0.5
v  0.5 -0.5  0.5
v  0.5  0.5  0.5
v -0.5  0.5  0.5

# 2. 纹理坐标 vt (u v)
vt 0.0 0.0
vt 1.0 0.0
vt 1.0 1.0
vt 0.0 1.0

# 3. 顶点法线 vn (x y z)
vn 0.0 0.0 -1.0
vn 0.0 0.0  1.0
vn -1.0 0.0 0.0
vn 1.0 0.0  0.0
vn 0.0 -1.0 0.0
vn 0.0  1.0 0.0

usemtl Red_Material   # 后续面使用材质 Red_Material

# 4. 面 f 格式：顶点索引/纹理索引/法线索引（索引从 1 开始）
f 1/1/1 2/2/1 3/3/1
f 1/1/1 3/3/1 4/4/1
```

## MTL：
在OBJ文件里使用mtllib xxx.mtl指明了这个模型对应的材质文件，使用usemtl 材质名指明了这个面使用哪个材质
**newmtl 材质名** ：定义一个新材质
**Ka r g b**：环境光颜色
**Kd r g b**：漫反射颜色
**Ks r g b**：镜面反射颜色
**Ns 数值**：高光大小（类似于`shininess/gloss`）
**d 0-1**：透明度（1：不透明 0：透明）
**Tr 0-1**：和d相反（`Tr=0`不透明）
**illum 2**：光照模式（写2就行了）
**map_Kd xxx.png**：漫反射贴图
**map_Ks xxx.png**：镜面反射贴图
**map_bump xxx.png**：凹凸贴图
**norm xxx.png**：法线贴图（PBR）
**map_Pr xxx.png**：粗糙度贴图
**map_Pm xxx.png**：金属度贴图
**map_Ke xxx.png**：自发光贴图
**map_RMA xxx.png**：三合一贴图（`Roughness,Metalness,AO`）
```mtl
newmtl Red_Material
Ka  0.2 0.2 0.2   
Kd  1.0 0.0 0.0   
Ks  0.5 0.5 0.5   
Ns  32.0          
d   1.0            
illum 2           

map_Kd container.png  
```
## COLLADA：
`XML`纯文本，所有资源拥有唯一 `id`，通过 `url="#id"` 互相引用
```dae
<?xml version="1.0" encoding="UTF-8"?>
<COLLADA xmlns="http://www.collada.org/2005/11/COLLADASchema" version="1.4.1">
  <!-- 1. 几何体库：存放顶点、面数据 -->
  <library_geometries>
    <geometry id="cube-geo" name="Cube">
      <mesh>
        <!-- 顶点位置 -->
        <source id="pos-source">
          <float_array id="pos-array" count="24">
            -0.5 -0.5 -0.5  0.5 -0.5 -0.5  ...
          </float_array>
        </source>
        <!-- 三角面索引 -->
        <triangles count="2">
          <p>0 1 2  0 2 3</p>
        </triangles>
      </mesh>
    </geometry>
  </library_geometries>

  <!-- 2. 材质库 -->
  <library_materials>
    <material id="red-mat" name="Red_Material">
      <instance_effect url="#red-effect"/>
    </material>
  </library_materials>

  <!-- 3. 节点层级（支持父子关系） -->
  <library_nodes>
    <node id="root-node" name="Root">
      <node id="cube-node" name="CubeNode">
        <instance_geometry url="#cube-geo">
          <bind_material>
            <instance_material url="#red-mat"/>
          </bind_material>
        </instance_geometry>
      </node>
    </node>
  </library_nodes>

  <!-- 4. 场景入口 -->
  <scene>
    <instance_node url="#root-node"/>
  </scene>
</COLLADA>
```
## FBX：
Autodesk 专有格式，默认二进制
```fbx
; FBX 注释
FBXHeaderExtension:  {
  CreationDate: "2026-06-09"
}

; 1. 顶点数据
Vertices:  {
  Data: -0.5,-0.5,-0.5, 0.5,-0.5,-0.5 ...
}

; 2. 面索引
PolygonVertexIndex: {
  Data: 0,1,2, 0,2,3
}

; 3. 材质
Material: "Red_Material" {
  DiffuseColor: 1.0,0.0,0.0
  SpecularColor: 0.5,0.5,0.5
}

; 4. 节点（层级结构）
Node: "Cube" {
  Translation: 0,0,0
  Rotation: 0,0,0
  Scale: 1,1,1
  Geometry: * => 引用上方网格
  Material: * => 引用上方材质
}
```
## GLTF/GLB：
`gltf` 文件（JSON 文本 + 外部 bin / 贴图）、`glb` 文件（单文件二进制）
```gltf
{
  "asset": { "version": "2.0", "generator": "Blender" },

  // 1. 缓冲区：引用外部二进制文件，包含完整的模型数据信息如顶点、纹理、索引
  "buffers": [
    { "uri": "cube.bin", "byteLength": 256 }
  ],

  // 2. 缓冲视图：切割二进制数据。每个缓冲存储一种数据信息，方便GPU读取，如顶点放入顶点缓冲区GL_ARRAY_BUFFER，索引放入索引缓冲区如GL_ELEMENT_ARRAY_BUFFER
  "bufferViews": [
    { "buffer": 0, "byteOffset": 0, "byteLength": 192, "target": 34962 },
    { "buffer": 0, "byteOffset": 192, "byteLength": 64,  "target": 34963 }
  ],
  //buffer指明要对哪一块缓冲区进行切分（由于buffers中只定义了一块缓冲区，即cube.bin所以这里都是0
  //byteOffset表明从.bin文件中的第几个字节开始切分，byteLength表明切下来的这一块占了多少字节
  //target表明切下来这一块存储到哪里。34962 = GL_ARRAY_BUFFER，34963 = GL_ELEMENT_ARRAY_BUFFER

  // 3. 访问器：解析数据类型、数量。告诉GPU怎么读取切下来的每一块缓冲
  "accessors": [
    { "bufferView": 0, "componentType": 5126, "type": "VEC3", "count": 8 },
    { "bufferView": 1, "componentType": 5123, "type": "SCALAR", "count": 36 }
  ],
  //bufferView表明这定义的是哪一块缓冲区的读取规则
  //componentType是数据类型。5126是GL_FLOAT，5123是GL_UNSIGNED_SHORT
  //type表示单个数据占的分量，VEC3表明每个数据是三分量，SCALAR表明每个数据是单分量
  //count表明这个缓冲区内有多少个数据，count=8表明有八个顶点，count=36表明有36个索引

  // 4. 材质
  "materials": [
    {
      "pbrMetallicRoughness": {
        "baseColorFactor": [1.0, 0.0, 0.0, 1.0],
        "metallicFactor": 0.1,
        "roughnessFactor": 0.5
      }
    }
  ],

  // 5. 网格：图元 + 材质
  "meshes": [
    {
      "primitives": [
        { "attributes": { "POSITION": 0 }, "indices": 1 }
      ],
      "material": 0
    }
  ],

  // 6. 节点：层级、变换、挂载网格。定义了场景中包含的所有节点
  "nodes": [
    { "mesh": 0, "translation": [0,0,0] }//第0号节点挂载的是第0号网格，把它平移到（0，0，0）
  ],

  // 7. 场景：根节点集合
  "scenes": [ { "nodes": [0] } ],//定义文件中包含的场景，这里只有0号场景，场景中包含一个节点，即0号节点
  "scene": 0//使用场景集合中的0号场景
}
```
```glb
把 JSON 头部 + 所有 bin 二进制 + 贴图 打包为单个二进制文件；
内部分多个 Chunk（数据块），第一块存 JSON，后续存二进制数据
```
## USD
```usd
#usda 1.0
def Xform "Root"
{
  # 根节点变换
  double3 xformOp:translate = (0, 0, 0)

  # 子节点：立方体网格
  def Mesh "Cube"
  {
    # 顶点坐标
    point3f[] points = [
      (-0.5, -0.5, -0.5), (0.5, -0.5, -0.5), ...
    ]
    # 面索引
    int[] faceVertexIndices = [0,1,2, 0,2,3]

    # 材质绑定
    rel material:binding = </RedMaterial>
  }
}

# 材质定义
def Material "RedMaterial"
{
  color3f inputs:diffuseColor = (1, 0, 0)
}
```
## PLY
```ply
ply
format ascii 1.0
comment 示例：一个三角形
element vertex 3
property float x
property float y
property float z
property uchar red
property uchar green
property uchar blue
element face 1
property list uchar int vertex_index
end_header

0.0 0.0 0.0 255 0 0
1.0 0.0 0.0 0 255 0
0.0 1.0 0.0 0 0 255

3 0 1 2
```
其中`comment`后边是注释；`element vertex 3`表示这个`ply`文件包含`3`个顶点；`property`开头的是顶点属性，这里包含位置三分量和颜色三分量，还可以包含法线、纹理；`element face 1`表示这个`ply`文件包含`1`个面；之后的三行数据每行分别表示一个顶点的三个位置分量和三个颜色分量；最后一行表示一个面，`3`表示这个面由3个顶点构成（是三角面，还支持`4`即四边形），然后是构成这个面的三个顶点的索引（从`0`开始）。
可以看到有非常多种模型文件格式，且每种格式包含的内容和组织的格式都不太一样，所以需要使用不同的规则去加载和解析每个文件。所幸的是，有一个库专门解决这个问题。

# Assimp模型加载库
将所有模型数据加载至通用数据结构，我们再从中读取所需的数据。
使用`Assimp`加载一个模型后，首先得到的是一个`Scene`对象。包含`mRootNode`（场景的根节点）、`mMeshes[]`（所有网格的数组，存储模型数据）、`mMaterials[]`（所有材质的数组）。对于`mMeshes[]`数组内的每一个网格对象，包含`mVertices[]`（顶点位置数组）、`mNormals[]`（顶点法线数组）、`mTextureCoords[]`（顶点纹理坐标数组）、`mFaces[]`（面数组）、`mMaterialIndex`（材质索引，指向`Scene.mMaterial[]`内的某一个材质）。对于`mFaces[]`内的每一个对象，又包含`mIndices[]`，表示构成这个面的顶点索引。一个面代表一个图元，可以是三角形，也可以是四边形，也可以是顶点。`mMaterials[]`内包含若干个材质对象，每个材质对象包含一些函数以便于获得材质属性。
`mRootNode`指向场景的根节点`Root Node`。`Assimp`就是按节点组织信息的。每个节点包含`mChildren[]`（子节点数组，包含所有子节点）、`mMeshes[]`（网格索引数组，每个索引指向`Scene`对象内的`mMeshes[]`内的一个网格）
**实际流程：**使用`Assimp`提供的相关函数加载模型，得到`Scene`对象；从`Scene`对象的`RootNode`开始，遍历场景中的每一个节点，取出他的`mMeshes[]`中的网格索引，到`Scene.mMeshes[]`中找到对应的网格，读取他的顶点位置、法线、纹理等属性值，存入自己定义的顶点缓冲区；再用`mesh`对象的`mMaterialIndex`到`Scene.mMaterials[]`中找到对应的材质；将上述数据整合得到一个`mesh`的数据，将多个`mesh`的数据整合得到一个`model`的数据，并存入`Model`对象。网格和模型的关系：一个模型包含多个网格，每个网格可以是模型的一部分如头部、手部、武器等。网格是绘制的最小单元。
**需要自己编写模型类和网格类的原因：**使用`assimp`库加载的模型都被存储为`assimp`的数据结构，但是我们需要让`OpenGL`能够解析和读取，并管理`VAO/VBO/EBO`，所以需要自己编写类进行上述转换。

# 网格
在这一节里，我们自己编写**网格类**。网格首先应该包含一系列的顶点信息，顶点信息又包含位置、法线和纹理坐标。然后是索引绘制需要的索引数组。最后是纹理形式的材质数据（比如漫反射和镜面反射贴图）。
那么**首先定义了顶点信息的结构体**：
```c
struct Vertex{
    glm::vec3 Position;
    glm::vec3 Normal;
    glm::vec3 Texcoords;
};
```
**其次定义了纹理信息的结构体**：
`assimp`加载出模型后，网格使用`mMaterials[]`中的`aiMaterial`对象提供的`GetTexture`方法获得纹理图片的文件路径或使用`mTextures[]中`的`aiTexture`对象获取到的纹理数据。前者是外部纹理，后者是内部纹理。之后都需要通过`glGenTexture`生成纹理`ID`，之后的操作都是使用这个纹理`ID`（如`glBindTetxure，glTexImage2D`等）。所以纹理信息结构体中需要存储纹理`ID`。此外，由于着色器中定义了多个`uniform`类型的纹理对象（如漫反射纹理、镜面反射纹理），在传递的时候，我们需要知道当前纹理是传给哪一个变量的，所以还需要存储纹理类型。
```c
struct Texture {
    unsigned int id;
    string type;
};
```
之后开始定义**网格类**。除了上面提到的三种数据（顶点、索引和纹理）之外，还需要一些函数。首先是构造函数，把`assimp`中的数据提取到上面三种数据中。然后是初始化缓冲函数，即初始化之前教程中提到的`VBO/VAO/EBO`。最后是绘制函数，它允许指定一个着色器，使用这个着色器进行绘制。
在初始化缓冲这个函数中，有一些涉及变量占据空间大小的地方不太容易理解，这里进行部分讲解。
**首先是顶点数据的传递**：第一个参数指的是传递的是顶点数据；第二个参数指的是整个顶点数据的大小，`vertices.size()`表明有多少个顶点，每个顶点都是一个结构体，而`sizeof(Vertex)`就是这个结构体的大小；第三个参数指的是从哪里开始读顶点数据，这里是取第一个顶点对应的数据的首地址；第四个参数指的是这些顶点数据只用来绘制，不会改变。
```c
glBufferData(GL_ARRAY_BUFFER, vertices.size() * sizeof(Vertex), &vertices[0], GL_STATIC_DRAW);
```
**其次是索引数据的传递**：第一个参数传递的是索引数据；第二个参数表明索引数据的大小，`indices.size()`表明有多少个索引，每个索引都是一个`unsigned int`类型的数据，所以一个索引的大小是`sizeof(unsigned int)`；第三个参数表明索引数据的首地址，即第一个索引的地址。
```c
glBufferData(GL_ELEMENT_ARRAY_BUFFER, indices.size() * sizeof(unsigned int), 
                 &indices[0], GL_STATIC_DRAW);
```
**接下来是顶点属性的设置**：分别是顶点位置、顶点法线和顶点纹理坐标。第一个参数对应`layout(position=xx)`中的xx，声明这个属性在顶点数据缓冲中是第几个；第二个参数表示一次读取的分量数，也就是一个这个数据占据的分量数，对于位置和法线都是三分量，对于纹理坐标是两分量；第三个参数表示每个数据的类型，这里都是`float`；第四个变量是是否要归一化，这里都是不需要；第五个数据是两个相同属性的属性之间相差的字节数，即读完一个`position`属性后，到下一个`position`属性之间的字节数（`position.x->position.x`），即到下一个顶点的`position`属性，横跨了一整个结构体的长度；第六个参数是这个属性在这个顶点的数据缓冲中的偏移，结构体的预处理指令`offsetof(结构体名，变量名）`给出了这个变量距离结构体头部的字节偏移量。
```c
glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, sizeof(Vertex), (void*)0);
glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, sizeof(Vertex), (void*)offsetof(Vertex, Normal));
glVertexAttribPointer(2, 2, GL_FLOAT, GL_FALSE, sizeof(Vertex), (void*)offsetof(Vertex, TexCoords));
```
**然后是Draw绘制函数的编写。**这个函数帮助我们把当前网格对象画在屏幕上。那么在画之前，我们需要准备好需要的纹理数据（顶点数据以及通过`VAO`设置好了，绑定就可以）。因为`textures`数组中可能有多张纹理，且有可能时多种类型的，但传递纹理数据又要求我们把当前的纹理传到对应的`uniform`变量。所以这里提出了统一命名的解决策略，`texture_typexx`，定义了这是哪一类纹理（`diffuse/specular/normal/height`）的第几张纹理（1/2/3……），在`Draw`函数中构造纹理名，根据纹理名查到`Shader`中`uniform`变量，获取其位置，绑定纹理单元，绑定纹理。构造纹理名的实现中，主要是统计每种类型的纹理已经有多少张了，下一张的命名中xx应该是多少。具体的，根据`textures[i].type`判断它属于哪一类型，然后让对应类型的纹理数量++，得到xx，然后拼接上`textures[i].type`。
```c
//Mesh.h
#pragma once
#ifndef MESH_H
#define MESH_H

#include <glad/glad.h>

#include <glm/glm.hpp>
#include <glm/gtc/matrix_transform.hpp>

#include <myShader.h>

#include <string>
#include <vector>

using namespace std;

#define MAX_BONE_INFLUENCE 4

struct Vertex {
        glm::vec3 Position;
        glm::vec3 Normal;
        glm::vec3 TexCoords;
        
        glm::vec3 Tangent;//解析法线贴图
        glm::vec3 Bitangent;//解析法线贴图
        int m_BoneIDs[MAX_BONE_INFLUENCE];//骨骼动画
        float m_Weights[MAX_BONE_INFLUENCE];//骨骼动画
};

struct Texture {
        unsigned int id;//根据路径加载图片，使用glGenTexture获得ID
        string type;
        string path;//从mMaterials中的材质对象中解析出来的纹理图片路径
};

class Mesh {
public:
        //网格数据
        vector<Vertex> vertices;
        vector<Texture> textures;
        vector<unsigned int> indices;
        unsigned int VAO;

        //构造函数
        Mesh(vector<Vertex> vertices, vector<Texture> textures, vector<unsigned int> indices) {
                //数据存储
                this->vertices = vertices;
                this->textures = textures;
                this->indices = indices;
                //数据传递
                setupMesh();
        }

        void Draw(Shader& shader) {
                unsigned int diffuseNr = 1;//漫反射贴图的编号
                unsigned int specularNr = 1;//镜面反射贴图的编号
                unsigned int normalNr = 1;//法线贴图的编号
                unsigned int heightNr = 1;//高度图的编号
                //完成纹理数据的设置和绑定
                for (unsigned int i = 0; i < textures.size(); i++) {//遍历所有贴图，可能包含漫反射贴图，镜面反射贴图或是其他贴图，需要根据type判断
                        //激活当前贴图对应的纹理单元
                        glActiveTexture(GL_TEXTURE0 + i);

                        string number;
                        string name = textures[i].type;
                        if (name == "texture_diffuse") {
                                number = to_string(diffuseNr++);
                        }
                        else if (name == "texture_specular") {
                                number = to_string(specularNr++);
                        }
                        else if (name == "texture_normal") {
                                number = to_string(normalNr++);
                        }
                        else if (name == "tetxure_height") {
                                number = to_string(heightNr++);
                        }
                        //获取Shader中这个uniform变量的位置
                        int textureLoc = glGetUniformLocation(shader.ID, (name + number).c_str());
                        //告诉Shader这个sampler2D指向第几个纹理单元
                        glUniform1i(textureLoc, i);
                        //当前纹理单元绑定第几号纹理
                        glBindTexture(GL_TEXTURE_2D, textures[i].id);
                }
                //绘制网格
                glBindVertexArray(VAO);
                //告诉GPU从EBO缓冲中哪里开始取索引，取多少个，每个索引的数据类型是什么，取了之后怎么画
                glDrawElements(GL_TRIANGLES, static_cast<unsigned int>(indices.size()), GL_UNSIGNED_INT, 0);
                glBindVertexArray(0);//解绑，不一定必要（因为绘制物体前都会先绑定这个物体的VAO，但最好加上）

                glActiveTexture(0);//跟上边解绑一样，使所有数据结构回到初始时的状态
        }

private:
        unsigned int VBO, EBO;
        void setupMesh() {
                //生成缓冲区
                glGenVertexArrays(1, &VAO);
                glGenBuffers(1, &VBO);
                glGenBuffers(1, &EBO);

                //绑定VAO
                glBindVertexArray(VAO);
                
                //生成VBO和EBO缓冲并传递数据
                glBindBuffer(GL_ARRAY_BUFFER, VBO);
                glBufferData(GL_ARRAY_BUFFER, vertices.size() * sizeof(Vertex), &vertices[0], GL_STATIC_DRAW);
                glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, EBO);
                glBufferData(GL_ELEMENT_ARRAY_BUFFER, indices.size() * sizeof(unsigned int), &indices[0], GL_STATIC_DRAW);

                //设置VBO的读取规则
                //Position
                glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, sizeof(Vertex), (void*)0);
                glEnableVertexAttribArray(0);
                //Normal
                glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, sizeof(Vertex), (void*)offsetof(Vertex, Normal));
                glEnableVertexAttribArray(1);
                //TexCoords
                glVertexAttribPointer(2, 2, GL_FLOAT, GL_FALSE, sizeof(Vertex), (void*)offsetof(Vertex, TexCoords));
                glEnableVertexAttribArray(2);
                //Tangent
                glVertexAttribPointer(3, 3, GL_FLOAT, GL_FALSE, sizeof(Vertex), (void*)offsetof(Vertex, Tangent));
                glEnableVertexAttribArray(3);
                //Bitangent
                glVertexAttribPointer(4, 3, GL_FLOAT, GL_FALSE, sizeof(Vertex), (void*)offsetof(Vertex, Bitangent));
                glEnableVertexAttribArray(4);
                //m_BoneIDs
                glVertexAttribPointer(5, 4, GL_INT, GL_FALSE, sizeof(Vertex), (void*)offsetof(Vertex, m_BoneIDs));
                glEnableVertexAttribArray(5);
                //m_Weights
                glVertexAttribPointer(6, 4, GL_FLOAT, GL_FALSE, sizeof(Vertex), (void*)offsetof(Vertex, m_Weights));
                glEnableVertexAttribArray(6);

                //解绑
                glBindVertexArray(0);
        }
};
#endif
```
或许还有别的方法解决上面的问题（从`textures[]`中取出了一张纹理，我不知道它应该传给`Shader`的哪一个`uniform`变量）：`Shader`中定义纹理数组如
```glsl
//fragmentShader
struct Material{
    sampler2D diffuse[4];//最多支持4张漫反射纹理
    sampler2D specular[2];
    sampler2D normal[2];
    sampler2D height[4];
};
uniform Material material;
```
`Draw()`中统计每类纹理的`index`，然后拼接到`uniform`变量名
```c
//Mesh.h
void Draw(Shader &shader){
    int diffuseIndex=0;
    int specularIndex=0;
    int normalIndex=0;
    int heightIndex=0;
    
    for(int i=0;i<textures.size();i++){
        glActiveTexture(GL_TEXTURE0+i);
        string name=textures[i].type;
        int idx=0;
        if(name=="texture_diffuse"){
            idx=diffuseIndex++;
        }else if(name=="texture_specular"){
            idx=specularIndex++;
        }else if(name=="tetxure_normal"){
            idx=normalIndex++;
        }else if(name=="texture_height"){
            idx=heightIndex++;
        }
        string uniformName="material."+name+"["+to_string(idx)+"]";
        int textureLoc=glGetUniformLocation(shader.ID,uniformName.c_str());
        glUniform1i(textureLoc,i);
        glBindTexture(GL_TEXTURE_2D,textures[i].id);
        
        glBindVertexArray(VAO);
        glDrawElements(GL_TRIANGLES,static_cast<unsigned int>(indices.size()),GL_UNSIGNED_INT,0);
        glBindVertexArray(0);
    }
}
```

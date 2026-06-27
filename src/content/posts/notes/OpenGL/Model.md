---
title: Model
published: 2026-06-27
description: 'Learn OpenGL 第三章第三节'
image: ''
tags: [OpenGL]
category: '学习笔记/OpenGL'
draft: false 
lang: 'zh'
---
# Assimp ReadFile 后期处理选项
`ReadFile` 函数第一个参数为**模型文件路径**，第二个参数为**后期处理选项**。`Assimp` 可在加载模型后自动对顶点、网格、UV、法线等数据进行预处理，简化手动解析成本，常用参数如下：
- **aiProcess_Triangulate**：强制将模型所有面片转换为三角面。无论原始模型是四边形、多边形，加载后统一转为三角形，适配 OpenGL 仅支持三角面渲染的规则。
- **aiProcess_FlipUVs**：翻转纹理坐标 Y 轴（`v = 1 - v`）。建模软件纹理原点为**左上角**，而 OpenGL 纹理原点为**左下角**，GPU 纹理采样自下而上，开启该选项可避免模型贴图上下颠倒，实现 UV 坐标对齐。
- **aiProcess_GenNormals**：自动生成顶点法线。若原始模型文件未携带法线数据，Assimp 会自动为每个顶点计算并生成法线，满足光照渲染需求。
- **aiProcess_SplitLargeMeshes**：分割大型网格。将顶点数量过大的网格拆分为多个小型子网格，适配显卡单次渲染最大顶点数限制，解决超大网格渲染报错问题。
- **aiProcess_OptimizeMeshes**：合并冗余网格。与分割网格相反，将场景中多个零散小网格拼接为一个大网格，减少渲染绘制调用次数，提升渲染性能。
- **aiProcess_CalcTangentSpace**：自动计算切线与副切线。为模型生成 TBN 切线空间，是**法线贴图渲染**的必要预处理选项。
# Assimp 场景节点（Node）
`Assimp` 模型采用节点层级结构管理场景数据，单个节点存储网格与子节点信息，核心参数如下：
- **node->mMeshes[]**：当前节点包含的网格索引数组，存储对应网格的编号
- **node->mNumMeshes**：当前节点含有的网格总数量
- **node->mChildren[]**：当前节点的子节点数组，用于构建模型层级结构
- **node->mNumChildren**：当前节点的子节点总数量
# Assimp 纹理坐标数量限制
`Assimp` 模型规范支持单个顶点**最多存储 8 套纹理坐标**，可适配多贴图叠加、多通道纹理场景。常规渲染中仅需使用**第一套纹理坐标**，其余纹理坐标可直接忽略。
# aiString 字符串转换方法
`Assimp` 内置专属字符串类型 `aiString`，无法直接被 C/C++ 识别，需通过专属方法转换：
- **.C_Str()**：将 `aiString` 类型转换为标准 C 语言字符串 `const char*`，用于读取模型材质、纹理路径等字符串数据。

# 实践
这一节里我们将创建另一个类，它将拆分`assimp`加载进来的一整个模型为之前我们创建的多个`mesh`，然后调用每个`mesh`的`Draw`函数完成绘制。
首先`public`部分向外提供了两个接口，分别是构造函数和绘制函数。构造函数传入文件路径，调用内部函数完成模型加载；绘制函数调用每个网格的绘制函数逐一绘制。
然后是`private`部分。模型加载函数调用`Assimp`库的函数完成加载，获得`aiScene`对象。调用`processNode`从根节点开始遍历，获得每个`node`的`mesh`。调用`processMesh`处理每个`mesh`，转换成自定义的`Mesh`类。
## 优化
定义一个`textures_loaded`数组存储所有已经加载过的贴图。每加载一张贴图之前，先遍历这个数组，看是否已经加载过（判断依据是路径是否相同），如果加载过了，则直接取出重用（只是不用加载贴图，但还是需要把这张贴图放入当前网格的`textures`数组中（需要根据当前网格的`textures`构建这个网格）。否则才加载，并存入`textures_loaded`。
```c
//Model.h
#pragma once
#ifndef MODEL_H
#define MODEL_H
#include <glad/glad.h>
//不需要在这里引入#include <stb_image.h>，会造成重定义
#include <glm/glm.hpp>
#include <glm/gtc/matrix_transform.hpp>

#include <assimp/Importer.hpp>
#include <assimp/scene.h>
#include <assimp/postprocess.h>

#include <myShader.h>
#include <Mesh.h>

#include <string>//定义字符串
#include <fstream>//文件读取（加载纹理/模型）
#include <sstream>//字符串拼接
#include <iostream>
#include <map>//缓存纹理（暂未用到）
#include <vector>

using namespace std;
class Model {
public:
        //构造函数
        Model(string const& path, bool gamma = false) :gammaCorrection(gamma) {
                loadModel(path);
        }
        void Draw(Shader& shader) {
                for (unsigned int i = 0; i < meshes.size(); i++) {
                        meshes[i].Draw(shader);
                }
        }

private:
        vector<Mesh> meshes;
        vector<Texture> textures_loaded;
        //因为模型需要贴图，且贴图是相对路径，所以需要知道模型在哪，才能够找到它的贴图
        string directory;//模型所在的文件夹，从构建模型时传入的path中截取
        bool gammaCorrection;

        //调用Assimp读取文件，拿到aiScene，调用processNode从整个场景的根节点开始遍历
        void loadModel(string const& path) {
                //声明了Assimp命名空间内的一个Importer
                Assimp::Importer importer;
                //调用ReadFile函数读取文件并根据要求进行额外处理
                const aiScene* scene = importer.ReadFile(path, aiProcess_Triangulate | aiProcess_FlipUVs | aiProcess_GenNormals | aiProcess_CalcTangentSpace);
                
                if (!scene || scene->mFlags & AI_SCENE_FLAGS_INCOMPLETE || !scene->mRootNode) {
                        //!scene：没加载出来
                        //AI_SCENE_FLAGS_INCOMPLETE：模型不完整、损坏
                        //!scene->mRootNode：没有根节点（空模型）
                        cout << "ERROR::ASSIMP::" << importer.GetErrorString() << endl;
                        return;
                }
                directory = path.substr(0, path.find_last_of('/'));//找到最后一个/，截取它前边的部分
                processNode(scene->mRootNode, scene);
        }
        //遍历模型树（整个场景按树形结构组织），获取当前节点的网格，把每个aiMesh*交给processMesh生成自定义Mesh类
        void processNode(aiNode* node, const aiScene* scene) {
                for (unsigned int i = 0; i < node->mNumMeshes; i++) {//遍历当前节点的所有网格
                        //使用节点网格列表中的每一个索引，到场景网格列表中找到对应的网格
                        aiMesh* mesh = scene->mMeshes[node->mMeshes[i]];
                        meshes.push_back(processMesh(mesh, scene));

                        //遍历当前节点的所有子节点，递归处理子节点中的网格
                        for (unsigned int i = 0; i < node->mNumChildren; i++) {
                                processNode(node->mChildren[i], scene);
                        }
                }
        }
        //把Assimp的aiMesh转成自定义Mesh类
        //包括读取Assimp顶点，填入Mesh.vertices；读取Assimp索引，填入Mesh.indices；读取Assimp材质，调用loadMaterialTextures处理贴图
        Mesh processMesh(aiMesh* mesh, const aiScene* scene) {
                vector<Vertex> vertices;
                vector<unsigned int> indices;
                vector<Texture> textures;

                for (unsigned int i = 0; i < mesh->mNumVertices; i++) {
                        Vertex vertex;
                        //处理每个顶点属性
                        //顶点位置
                        glm::vec3 vector;
                        vector.x = mesh->mVertices[i].x;
                        vector.y = mesh->mVertices[i].y;
                        vector.z = mesh->mVertices[i].z;
                        vertex.Position = vector;

                        //顶点法线
                        if (mesh->HasNormals()) {
                                //不是所有模型都带法线，如果模型没有法线，就不需要处理
                                vector.x = mesh->mNormals[i].x;
                                vector.y = mesh->mNormals[i].y;
                                vector.z = mesh->mNormals[i].z;
                                vertex.Normal = vector;
                        }

                        //顶点纹理坐标
                        if (mesh->mTextureCoords[0]) {
                                //不是所有模型都有纹理坐标
                                //且模型可以有多套纹理坐标，这里只取第一套
                                glm::vec2 vec;
                                vec.x = mesh->mTextureCoords[0][i].x;//为什么需要两层索引？
                                vec.y = mesh->mTextureCoords[0][i].y;
                                vertex.TexCoords = vec;

                                //切线
                                //切线和副切线都是给法线贴图用的，而要使用法线贴图必须要有UV，如果没有UV就不需要构造法线和法线贴图了
                                vector.x = mesh->mTangents[i].x;
                                vector.y = mesh->mTangents[i].y;
                                vector.z = mesh->mTangents[i].z;
                                vertex.Tangent = vector;

                                //副切线
                                vector.x = mesh->mBitangents[i].x;
                                vector.y = mesh->mBitangents[i].y;
                                vector.z = mesh->mBitangents[i].z;
                                vertex.Bitangent = vector;
                        }
                        else {
                                vertex.TexCoords = glm::vec2(0.0f, 0.0f);//Vertex结构体中的每一个变量都需要赋值，不能留空
                                //法线没有else是因为使用了aiProcess_GenNormals，如果模型没有法线会自动生成
                        }

                        vertices.push_back(vertex);
                }
                //处理索引
                //把构成每个面的顶点索引，按顺序存入indices数组
                for (unsigned int i = 0; i < mesh->mNumFaces; i++) {
                        aiFace face = mesh->mFaces[i];
                        for (unsigned int j = 0; j < face.mNumIndices; j++) {
                                indices.push_back(face.mIndices[j]);
                        }
                }
                //处理材质
                if (mesh->mMaterialIndex >= 0) {
                        //materialIndex时网格的材质编号，据此索引到材质列表中的某个具体材质
                        //materialIndex>=0表示该网格有材质，否则该网格没有材质，无需处理
                        aiMaterial* material = scene->mMaterials[mesh->mMaterialIndex];
                        vector<Texture> diffuseMaps = loadMaterialTextures(material, aiTextureType_DIFFUSE, "texture_diffuse");
                        textures.insert(textures.end(), diffuseMaps.begin(), diffuseMaps.end());

                        vector<Texture> specularMaps = loadMaterialTextures(material, aiTextureType_SPECULAR, "texture_specular");
                        textures.insert(textures.end(), specularMaps.begin(), specularMaps.end());

                        vector<Texture> normalMaps = loadMaterialTextures(material, aiTextureType_NORMALS, "texture_normal");
                        textures.insert(textures.end(), normalMaps.begin(), normalMaps.end());

                        vector<Texture> heightMaps = loadMaterialTextures(material, aiTextureType_HEIGHT, "texture_height");
                        textures.insert(textures.end(), heightMaps.begin(), heightMaps.end());
                }
                return Mesh(vertices, textures, indices);
        }
        //读取当前材质指定类型的所有纹理
        vector<Texture> loadMaterialTextures(aiMaterial* mat, aiTextureType type, string typeName) {
                vector<Texture> textures;
                for (unsigned int i = 0; i < mat->GetTextureCount(type); i++) {
                        aiString str;
                        mat->GetTexture(type, i, &str);//拿哪种类型的第几张纹理（从头开始拿），并返回这张纹理的路径
                        bool skip = false;
                        for (unsigned int j = 0; j < textures_loaded.size(); j++) {
                                if (strcmp(textures_loaded[j].path.data(), str.C_Str()) == 0) {
                                        textures.push_back(textures_loaded[j]);//已经加载过了，则直接重用
                                        skip = true;
                                        break;
                                }
                        }
                        if (!skip) {
                                Texture texture;
                                texture.id = TextureFromFile(str.C_Str(), directory);
                                texture.type = typeName;
                                texture.path = str.C_Str();
                                textures.push_back(texture);
                                textures_loaded.push_back(texture);
                        }
                }
                return textures;
        }

        unsigned int TextureFromFile(const char* relativePath, const string &directory, bool gamma = false) {
                string filename = string(relativePath);
                filename = directory + '/' + filename;//只有string类型才能进行字符串拼接

                unsigned int textureID;
                glGenTextures(1, &textureID);
                
                int width, height, nrChannels;
                unsigned char* data = stbi_load(filename.c_str(), &width, &height, &nrChannels, 0);//stb_image需要接收const char*类型的路径
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

                        glBindTexture(GL_TEXTURE_2D, textureID);
                        glTexImage2D(GL_TEXTURE_2D, 0, format, width, height, 0, format, GL_UNSIGNED_BYTE, data);//这里要记得传入图片数据！否则纹理加载成功，但是模型全黑！！
                        glGenerateMipmap(GL_TEXTURE_2D);

                        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_REPEAT);
                        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_REPEAT);
                        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR_MIPMAP_LINEAR);
                        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
                }
                else {
                        cout << "Texture failed to load at path:" << filename << endl;
                }
                stbi_image_free(data);
                return textureID;
        }
};
#endif
```
在`main.cpp`中使用上述模型类加载一个背包模型：
![BQACAgUAAyEGAASHRsPbAAEWKuJqP2Oxc9ZewSow_A8pUFZ8ozclsgACBCQAAk05AVYCcebMrZGVaTwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWKuJqP2Oxc9ZewSow_A8pUFZ8ozclsgACBCQAAk05AVYCcebMrZGVaTwE.png)
加上光照后的结果：
![BQACAgUAAyEGAASHRsPbAAEWKuZqP2QWSIXud-9iZ8gfHHnbzoU8ewACCiQAAk05AVbogLova4bLRzwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWKuZqP2QWSIXud-9iZ8gfHHnbzoU8ewACCiQAAk05AVbogLova4bLRzwE.png)
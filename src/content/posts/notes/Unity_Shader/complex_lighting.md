---
title: 更复杂的光照
published: 2026-06-14
description: '《Unity Shader 入门精要》第9章'
image: ''
tags: [Unity]
category: '学习笔记/Unity Shader 入门精要'
draft: false 
lang: 'zh'
---
# 渲染路径
## Unity 渲染路径
1. Unity中的渲染路径包括：前向渲染路径、延迟渲染路径。

2. 设置渲染路径
    （1）为整个项目设置统一的渲染路径：在 `EDIT->Project Setting->Player->Other Settings->Rendering Path` 中选择。
    （2）为每个相机选择独立渲染路径：在摄像机组件的 `rendering path` 中设置。
    完成设置后，可在每个 **Pass** 中使用 `LightMode` 标签指定该 Pass 对应的渲染路径。

3. Unity 会根据不同渲染路径，准备并赋值对应的光照变量传递给 Shader，同时不同渲染路径配套使用专属光照函数。

## 前向渲染
对场景内每个物体，针对影响该物体的每一盏光源，依次完成深度测试、光照计算、颜色缓冲写入。

Unity 将光源分为三类：
- **逐像素光**：亮度最高、支持阴影，单物体最多 4 盏；
- **逐顶点光**：单物体最多 4 盏，光照在顶点着色器中计算；
- **SH 光**：剩余所有光源，运算速度快，仅支持漫反射，无阴影。

前向渲染包含两个核心 Pass：`ForwardBase`、`ForwardAdd`
- **ForwardBase**：处理1盏带阴影的主方向光、全部SH光、逐顶点光、环境光、自发光与环境贴图，计算结果直接写入帧缓存。
- **ForwardAdd**：每新增1盏逐像素光便会调用一次，光照结果与帧缓存已有颜色进行混合。

## 顶点照明渲染
属于前向渲染的子集。
对每个物体，在顶点着色器中遍历场景内所有有效光源（最多8盏），在顶点位置累加合并所有光源的光照贡献。

## 延迟渲染
整体分为两个 Pass：
1. **第一Pass**：计算所有可见片元，将片元信息（漫反射颜色、世界空间法线、高光颜色+高光指数、自发光+光照贴图+反射探针、深度缓冲、模板缓冲）存入 **G-Buffer**。
2. **第二Pass**：逐像素遍历全屏画面，从 G-Buffer 多张纹理中读取数据，逐光源计算光照贡献，叠加环境光后得到最终像素颜色。

### 缺点
- 不支持常规抗锯齿；
- 不支持半透明效果（无法完成颜色混合）；
- 要求显卡支持 **MRT（多渲染目标）**（用于输出多张 G-Buffer 纹理）。


# 光照类型
1. 平行光：无位置、有方向且是全局统一方向（到场景各物体方向一样），无衰减。
2. 点光源：有位置、无方向（向四面八方），有衰减。
3. 聚光灯：有位置、有方向、有衰减。

在unity中编写forwardBase和forwardAdd pass。渲染一个平行光+一个点光源。已知平行光会走forwardBase，点光源会走forwardAdd。

---

## 使用 FrameDebugger 观察 ForwardBase / ForwardAdd 调用流程
本次测试场景：**1盏平行光 + 4盏点光源**，所有点光源 `Render Mode` 设为 `Auto`。
Unity 会自动区分光源计算方式，由于 ForwardAdd 最多支持 4 盏逐像素光源，因此这 4 盏点光源全部以**逐像素**形式在 `ForwardAdd` 中执行。

```glsl
// Upgrade NOTE: replaced '_LightMatrix0' with 'unity_WorldToLight'

Shader "Unlit/NewUnlitShader"
{
    Properties
    {
        _Color ("Color Tint",Color) = (1,1,1,1)
        _Specular ("Specular",Color) = (1,1,1,1)
        _Gloss ("Gloss",Range(8,256)) = 20

    }
    SubShader
    {

        Pass
        {
            Tags {"LightMode" = "ForwardBase"}
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile_fwdbase

            #include "Lighting.cginc"

            fixed4 _Color;
            fixed4 _Specular;
            float _Gloss;

            struct a2v
            {
                float4 vertex : POSITION;
                float3 normal:NORMAL;
            };

            struct v2f
            {
                float4 pos : SV_POSITION;
                float3 worldPos : TEXCOORD0;
                float3 worldNormal : TEXCOORD1;
            };

            v2f vert (a2v v)
            {
                v2f o;
                o.pos = UnityObjectToClipPos(v.vertex);
                o.worldPos = mul(unity_ObjectToWorld,v.vertex).xyz;
                o.worldNormal = UnityObjectToWorldNormal(v.normal);
                return o;
            }

            fixed4 frag (v2f i) : SV_Target
            {
                float3 worldNormal=normalize(i.worldNormal);
                float3 worldLightDir=normalize(UnityWorldSpaceLightDir(i.worldPos));
                fixed3 ambient = UNITY_LIGHTMODEL_AMBIENT.xyz*_Color.rgb;
                fixed3 diffuse=_LightColor0.rgb*_Color.rgb*saturate(dot(worldNormal,worldLightDir));
                float3 worldViewDir=normalize(UnityWorldSpaceViewDir(i.worldPos));
                fixed3 halfDir=normalize(worldLightDir+worldViewDir);
                fixed3 specular=_LightColor0.rgb*_Specular.rgb*pow(saturate(dot(worldNormal,halfDir)),_Gloss);
                fixed atten=1.0;
                return fixed4(ambient+(diffuse+specular)*atten,1.0);
            }
            ENDCG
        }

        Pass{
            Tags {"LightMode" = "ForwardAdd"}
            Blend One One
            CGPROGRAM
            #pragma multi_compile_fwdadd//使用的光照衰减等变量可以被正确赋值
            #pragma vertex vert
            #pragma fragment frag
            #include "Lighting.cginc"
            #include "AutoLight.cginc"//引用了这个头文件才能得到unity_WorldToLight

            fixed3 _Color;
            fixed3 _Specular;
            float _Gloss;
            struct a2v
            {
                float4 vertex : POSITION;
                float3 normal:NORMAL;
            };

            struct v2f
            {
                float4 pos : SV_POSITION;
                float3 worldPos : TEXCOORD0;
                float3 worldNormal : TEXCOORD1;
            };

            v2f vert (a2v v)
            {
                v2f o;
                o.pos = UnityObjectToClipPos(v.vertex);
                o.worldPos = mul(unity_ObjectToWorld,v.vertex).xyz;
                o.worldNormal = UnityObjectToWorldNormal(v.normal);
                return o;
            }

            fixed4 frag (v2f i) : SV_Target
            {
                fixed3 worldNormal=normalize(i.worldNormal);
                #ifdef USING_DIRECTIONAL_LIGHT
                    fixed3 worldLightDir=normalize(_WorldSpaceLightPos0.xyz);
                    fixed atten=1.0;
                #else
                    fixed3 worldLightDir=normalize(_WorldSpaceLightPos0.xyz-i.worldPos.xyz);
                    float3 lightCoord=mul(unity_WorldToLight,float4(i.worldPos,1.0)).xyz;//将像素坐标由世界空间转到光源空间，计算它到光源的距离
                    fixed atten=tex2D(_LightTexture0,dot(lightCoord,lightCoord).rr).UNITY_ATTEN_CHANNEL;//使用距离的平方采样衰减纹理，而非距离，避免了开方。因为tex2D接收二维坐标，而dot计算出的是一个数字，.rr表示将这个数字转为uv坐标，其中u=v=dot值。至于u=v是因为衰减纹理是一张1D纹理，对对角线采样即可
                #endif
                
                fixed3 diffuse=_LightColor0.rgb*_Color.rgb*saturate(dot(worldNormal,worldLightDir));
                float3 worldViewDir=normalize(UnityWorldSpaceViewDir(i.worldPos));
                float3 halfDir=normalize(worldLightDir+worldViewDir);
                fixed3 specular=_LightColor0.rgb*_Specular.rgb*pow(saturate(dot(worldNormal,halfDir)),_Gloss);
                
                return fixed4((diffuse+specular)*atten,1.0);
            }
            ENDCG
        }
    }
    FallBack "Diffuse"
}
```

整个场景渲染共计 **11 个渲染事件**，分步解析如下：

### 1. 事件1：清除阴影贴图
清空颜色缓冲、深度缓冲、模板缓冲，为阴影渲染做初始化准备。
![BQACAgUAAyEGAASHRsPbAAEVeg9qLnUiXBWWAWUCqcFwLoLvGqQkxwACsSQAAhZseFV8y3NGWGs4JjwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEVeg9qLnUiXBWWAWUCqcFwLoLvGqQkxwACsSQAAhZseFV8y3NGWGs4JjwE.png)

### 2. 事件2、3：渲染方向光级联阴影（`Shadows.RenderJobDir`）
从**灯光视角**渲染物体阴影，渲染目标为尺寸 `4096*4096` 的阴影贴图。
- 开启深度测试与深度写入，**仅写入深度缓冲，不写入颜色缓冲**
- 主方向光默认使用**级联阴影贴图**，将相机视锥划分为多个层级，不同距离区域使用不同精度阴影
- 物体若跨越多个级联区域，会在每一级联阴影贴图中重复绘制
- 示例中胶囊体跨两个级联区域，因此出现两次 `Draw Mesh Capsule`
- 该阶段使用 Shader 内的 `ShadowCaster` Pass
![BQACAgUAAyEGAASHRsPbAAEVehBqLnVkStEEdINo9lBwUJod5wmMZAACsiQAAhZseFU7Ik37ESf3sDwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEVehBqLnVkStEEdINo9lBwUJod5wmMZAACsiQAAhZseFU7Ik37ESf3sDwE.png)
![BQACAgUAAyEGAASHRsPbAAEVehJqLnWcfQzEO7nmnEO6XP1NdRaNMwACtCQAAhZseFUQ59mSEtCTXTwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEVehJqLnWcfQzEO7nmnEO6XP1NdRaNMwACtCQAAhZseFUQ59mSEtCTXTwE.png)

### 3. 事件4、5：构建屏幕空间阴影（`Shadow.CollectShadows`）
从**相机视角**生成屏幕空间阴影贴图。
1. **事件4**：清空屏幕空间阴影贴图，完成画布初始化。贴图像素与屏幕像素一一对应，黑色代表无阴影，后续通过混合叠加阴影区域。
![BQACAgUAAyEGAASHRsPbAAEVehNqLnW8BlCf69beRnXQQmutdrdI9AACtiQAAhZseFVicBSPek0HzTwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEVehNqLnW8BlCf69beRnXQQmutdrdI9AACtiQAAhZseFVicBSPek0HzTwE.png)
![BQACAgUAAyEGAASHRsPbAAEVehdqLnXfFT3atqsdg8tNGlXlyai0HgACuiQAAhZseFWpDg0rJxMvVDwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEVehdqLnXfFT3atqsdg8tNGlXlyai0HgACuiQAAhZseFWpDg0rJxMvVDwE.png)
2. **事件5**：生成屏幕空间阴影，使用**全屏四边形**执行专用阴影着色器，执行逻辑：
    - `ZTest Always`：所有像素均通过深度测试，进入片元着色器
    - `ZWrite Off`：不修改原有深度缓冲，仅读取数据、写入颜色缓冲
    - 执行流程：读取相机深度纹理 → 还原像素世界坐标 → 变换到灯光空间 → 采样阴影贴图 → 深度对比判断阴影状态 → 结果写入屏幕空间阴影贴图
    - 混合模式为直接写入
![BQACAgUAAyEGAASHRsPbAAEVehtqLnX53Pck27UNcU7FCY59DVig_AACviQAAhZseFWv981bKFn4iDwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEVehtqLnX53Pck27UNcU7FCY59DVig_AACviQAAhZseFWv981bKFn4iDwE.png)
![BQACAgUAAyEGAASHRsPbAAEVeh5qLnYRMtvQEq7368-3vxQk-UhVDgACwSQAAhZseFXKyBLHl3zDFTwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEVeh5qLnYRMtvQEq7368-3vxQk-UhVDgACwSQAAhZseFXKyBLHl3zDFTwE.png)

### 4. 事件6：清空临时缓存
清理渲染临时缓冲区，正式开始场景主体渲染。
![BQACAgUAAyEGAASHRsPbAAEVeiFqLnYq2DqcTHeJQjolgmgNzoucpwACxSQAAhZseFX0ltTNt2dL4DwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEVeiFqLnYq2DqcTHeJQjolgmgNzoucpwACxSQAAhZseFX0ltTNt2dL4DwE.png)

### 5. 事件7 ~ 11：场景主体渲染（共5个事件，对应5盏光源）
依次处理平行光与4盏点光源，区分 `ForwardBase` 与 `ForwardAdd` 行为：
1. **平行光（ForwardBase）**
    - `ZTest LE`：开启正常深度测试
    - `ZWrite On`：写入深度缓冲，构建场景深度信息
    - 混合模式为**直接写入**，作为物体基础底色层
![BQACAgUAAyEGAASHRsPbAAEVeiVqLnZLDE188quUDqnCZ_wEOBglOQACySQAAhZseFU526k_DKmTnzwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEVeiVqLnZLDE188quUDqnCZ_wEOBglOQACySQAAhZseFU526k_DKmTnzwE.png)
![BQACAgUAAyEGAASHRsPbAAEVeihqLnZqGhYVj_eEWzwNTSPUxCKPVQACzSQAAhZseFW_i3lO1fhtgDwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEVeihqLnZqGhYVj_eEWzwNTSPUxCKPVQACzSQAAhZseFW_i3lO1fhtgDwE.png)
2. **4 盏点光源（ForwardAdd）**
    - 渲染顺序受光源距离、强度影响；本案例光源强度一致，**距离相机越近越先渲染**
    - 同样开启深度测试与深度写入
    - 混合模式为**加法混合**，将光照效果叠加到已有画面上
    - 一共执行 4 次绘制，印证：**每多一盏逐像素光源，就会调用一次 ForwardAdd Pass**
![BQACAgUAAyEGAASHRsPbAAEVeitqLnaNE3g_ynqAmT51nF5jCd9bhgAC0CQAAhZseFWeygJgM5qbgjwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEVeitqLnaNE3g_ynqAmT51nF5jCd9bhgAC0CQAAhZseFWeygJgM5qbgjwE.png)
![BQACAgUAAyEGAASHRsPbAAEVeixqLnaniQsd54uKIFedMSd8s0g6-QAC0SQAAhZseFUHbScaWYJsaTwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEVeixqLnaniQsd54uKIFedMSd8s0g6-QAC0SQAAhZseFUHbScaWYJsaTwE.png)
---

## Render Mode 为 Not Important 时的渲染表现
1. **四个点光源设置为 Not Important**
光源不再走 `ForwardAdd` 逐像素计算，转而在 `ForwardBase` 中以**逐顶点**方式处理。若 Shader 未编写逐顶点光照逻辑，该部分光源最终不会产生光照效果。
![BQACAgUAAyEGAASHRsPbAAEVei9qLnbBsOwGdESxq56s4awAAaIDqaQAAtQkAAIWbHhV24Mq1mWvy488BA.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEVei9qLnbBsOwGdESxq56s4awAAaIDqaQAAtQkAAIWbHhV24Mq1mWvy488BA.png)

2. **平行光设置为 Not Important**
物体会整体变黑，但 `ForwardBase` 对应的渲染事件依然存在。
原因：`ForwardBase` 除处理主光源外，还负责环境光、自发光、光照贴图等内容，不会因主光源关闭而省略整个 Pass。
![BQACAgUAAyEGAASHRsPbAAEVejFqLnbWzmgmiLy7jdY3YTy_kCblZQAC2CQAAhZseFV523mZPBQ0aTwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEVejFqLnbWzmgmiLy7jdY3YTy_kCblZQAC2CQAAhZseFV523mZPBQ0aTwE.png)

# 阴影
## 阴影基础原理
Unity 阴影基于**阴影贴图（Shadow Map）**技术实现：
将相机放置在光源位置，光源视角下不可见的区域即为阴影区域。针对每个光源单独生成一张阴影贴图，记录光源视角下场景内距离光源最近的表面深度信息。
该绘制逻辑在 `LightMode = ShadowCaster` 的 Pass 中执行。

若开启**屏幕空间阴影映射**，此阶段还会生成**相机深度纹理**（尺寸等同于屏幕分辨率），记录相机视角下每个像素到相机的最近距离。

最终结合**相机深度纹理**与**光源阴影贴图**计算屏幕空间阴影：
像素在相机深度图中的实际深度，大于该像素转换到光源空间后采样阴影贴图得到的光源深度时，代表该位置被遮挡，处于阴影中。

## 不透明物体投射阴影实现
1. 组件设置
    - 投射阴影的物体：在 `MeshRenderer` 组件开启 **Cast Shadows On**
    - 接收阴影的物体：在 `MeshRenderer` 组件开启 **Receive Shadows**
2. 着色器配置
    将前向渲染着色器赋值给物体材质，**着色器必须配置 FallBack**。
    前向渲染仅定义 `ForwardBase`、`ForwardAdd` 两个 Pass，无独立 `ShadowCaster` Pass，阴影投射逻辑依赖 FallBack 中内置的 `ShadowCaster` Pass 实现。
![BQACAgUAAyEGAASHRsPbAAEVetVqLoMUWYUL1p5pLIATj4mygwWS6gAChiUAAhZseFUVX6sHUIwy2zwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEVetVqLoMUWYUL1p5pLIATj4mygwWS6gAChiUAAhZseFUVX6sHUIwy2zwE.png)
3. 双面阴影问题
    - 默认阴影贴图仅计算**物体正面**：仅正面遮挡光线可投射阴影，背面遮挡无效。场景中平面以背面遮挡光源时，无法正常投射阴影。
    - 将 `Cast Shadows` 设置为 **Two Sided**，可让平面向下侧平面投射阴影。
    - 若立方体仍无法接收阴影，原因是立方体着色器未编写阴影接收逻辑。
![BQACAgUAAyEGAASHRsPbAAEVet9qLoNgpEQZyqeq0dGK-f8hiL09zQACkSUAAhZseFVUfKcssR9LYzwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEVet9qLoNgpEQZyqeq0dGK-f8hiL09zQACkSUAAhZseFVUfKcssR9LYzwE.png)

## 不透明物体接收阴影实现
阴影接收借助 Unity 内置文件 `AutoLight.cginc` 提供的宏实现，流程分为三步：
1. 定义阴影纹理采样坐标
2. 计算阴影纹理采样坐标
3. 通过坐标采样阴影纹理，获取阴影遮罩值

- `ForwardBase`：负责计算主平行光的阴影接收
- `ForwardAdd`：负责计算其余逐像素光源的阴影接收
![BQACAgUAAyEGAASHRsPbAAEVeuJqLoOFAQMAAT6wGucmpixJgCzSBqsAApQlAAIWbHhVT78LLVn-R_g8BA.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEVeuJqLoOFAQMAAT6wGucmpixJgCzSBqsAApQlAAIWbHhVT78LLVn-R_g8BA.png)
```glsl
Pass
{
    Tags {"LightMode" = "ForwardBase"}//可计算主平行光的阴影
    CGPROGRAM
    #pragma vertex vert
    #pragma fragment frag
    #pragma multi_compile_fwdbase

    #include "Lighting.cginc"
    #include "AutoLight.cginc"//计算阴影时使用的宏来自于这个文件

    fixed3 _Color;
    fixed3 _Specular;
    fixed _Gloss;

    struct a2v
    {
        float4 vertex : POSITION;
        float3 normal:NORMAL;
    };

    struct v2f
    {
        float4 pos : SV_POSITION;
        float3 worldPos:TEXCOORD0;
        float3 worldNormal:TEXCOORD1;
        SHADOW_COORDS(2)；//声明对阴影纹理采样的坐标_ShadowCoord，2指的是下一个可用的插值寄存器的索引值
    };

    v2f vert (a2v v)
    {
        v2f o;
        o.pos = UnityObjectToClipPos(v.vertex);
        o.worldPos=mul(unity_ObjectToWorld,v.vertex).xyz;
        o.worldNormal=UnityObjectToWorldNormal(v.vertex);
        TRANSFER_SHADOW(o);//计算v2f中声明的阴影纹理坐标：传统阴影映射(shadow map)：把顶点从模型空间转到光源空间；屏幕空间阴影：_ShadowCoord=computeScreenPos
        return o;
    }

    fixed4 frag (v2f i) : SV_Target
    {
        float3 worldNormal=normalize(i.worldNormal);
        float3 worldLightDir=normalize(UnityWorldSpaceLightDir(i.worldPos));
        float3 worldViewDir=normalize(UnityWorldSpaceViewDir(i.worldPos));
        float3 halfDir=normalize(worldLightDir+worldViewDir);

        fixed3 ambient=UNITY_LIGHTMODEL_AMBIENT.xyz*_Color.rgb;
        fixed3 diffuse=_LightColor0.rgb*_Color.rgb*saturate(dot(worldLightDir,worldNormal));
        fixed3 specular=_LightColor0.rgb*_Specular.rgb*pow(saturate(dot(worldNormal,halfDir)),_Gloss);
        fixed atten=1.0;
        fixed shadow=SHADOW_ATTENUATION(i);//使用_ShadowCoord对阴影纹理进行采样，得到阴影信息
        return fixed4(ambient+(diffuse+specular)*atten*shadow,1.0);//将阴影乘到输出颜色上
    }
    ENDCG
}
```

### 基于 FrameDebugger 解析完整阴影渲染流程
#### 1. UpdateDepthTexture（更新相机深度纹理）
帧执行最前端，生成/更新**相机深度纹理**，分辨率与屏幕一致，像素存储相机视角下**非线性深度值（0~1）**。
- 执行物体的 `ShadowCaster` Pass
- 渲染状态：`ZWrite On`（仅写入深度）、`ColorMask 0`（不输出颜色）
- 用途：为屏幕空间阴影提供深度数据

执行步骤：
1. 清空缓冲区
![BQACAgUAAyEGAASHRsPbAAEVeuRqLoOsU8aMDo8lmbPT6WHspcisRQAClyUAAhZseFWwy42a_8Y6TDwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEVeuRqLoOsU8aMDo8lmbPT6WHspcisRQAClyUAAhZseFWwy42a_8Y6TDwE.png)
2. 遍历所有开启深度写入、阴影投射的物体，依次执行 `ShadowCaster` Pass
![BQACAgUAAyEGAASHRsPbAAEVeudqLoPLnFCnaZYbmJB-e2ZIAtGmjAACmiUAAhZseFU8t8pZPWhVoTwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEVeudqLoPLnFCnaZYbmJB-e2ZIAtGmjAACmiUAAhZseFU8t8pZPWhVoTwE.png)
![BQACAgUAAyEGAASHRsPbAAEVeulqLoPmdNZ1S47E9-ylSyNzYsBVPwACnCUAAhZseFXBKJ4DFdVXTzwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEVeulqLoPmdNZ1S47E9-ylSyNzYsBVPwACnCUAAhZseFXBKJ4DFdVXTzwE.png)
![BQACAgUAAyEGAASHRsPbAAEVeutqLoQGx4Pvo9T8riM78DLvD3HeIgACniUAAhZseFXd_1xd8ysJujwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEVeutqLoQGx4Pvo9T8riM78DLvD3HeIgACniUAAhZseFXd_1xd8ysJujwE.png)

#### 2. RenderShadowMap（渲染光源阴影贴图）
切换至**主光源视角**，重新渲染场景，生成光源视角的深度贴图（Shadow Map）。
平行光使用**级联阴影**，会拆分多个 Pass 渲染不同距离层级的阴影。

执行步骤：
1. 清空缓冲区
2. 执行平行光阴影渲染任务，按级联分层绘制
3. 遍历场景物体，调用各自 `ShadowCaster` Pass 

![BQACAgUAAyEGAASHRsPbAAEVeuxqLoQfm4tL83_qY95cmW4fvF5fIAACnyUAAhZseFWzJx-Heq_7oDwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEVeuxqLoQfm4tL83_qY95cmW4fvF5fIAACnyUAAhZseFWzJx-Heq_7oDwE.png)

影响渲染次数的因素：
- 级联层级：物体跨越 `N` 个级联区域，就会被重复渲染 `N` 次
- 合批规则：Shader、变体、材质参数完全一致的物体会合为单次 Draw Call；存在差异则拆分多次 Draw Call（同模型也会拆分）

#### 3. CollectShadows（生成屏幕空间阴影图）
结合相机深度纹理、光源阴影贴图，计算生成**屏幕空间阴影图（Screenspace ShadowMap）**。

执行步骤：
1. 清空缓冲区
2. 全屏绘制：所有像素执行深度对比，将阴影结果写入颜色缓冲，**不修改原有深度缓冲**

![BQACAgUAAyEGAASHRsPbAAEVeu5qLoRMlZEWTZsAAccW63FaHIbo-gkAAqElAAIWbHhVXVM8pm0YXXg8BA.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEVeu5qLoRMlZEWTZsAAccW63FaHIbo-gkAAqElAAIWbHhVXVM8pm0YXXg8BA.png)
![BQACAgUAAyEGAASHRsPbAAEVevBqLoRuCtAZBX0r2j3d5tZckBFimQACoyUAAhZseFV5912zvPmDRTwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEVevBqLoRuCtAZBX0r2j3d5tZckBFimQACoyUAAhZseFV5912zvPmDRTwE.png)

#### 4. 场景正式渲染
1. 清空缓冲区
2. 绘制场景物体
    - 渲染顺序：**先绘制不透明物体，后绘制透明物体**
    - 同类型物体内部：遵循**由远及近**渲染规则

![BQACAgUAAyEGAASHRsPbAAEVevFqLoSLh6JAgxxmQU51VWbSH9hb4AACpCUAAhZseFUAARYP4dwLM3k8BA.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEVevFqLoSLh6JAgxxmQU51VWbSH9hb4AACpCUAAhZseFUAARYP4dwLM3k8BA.png)

## 使用内置宏统计计算阴影和衰减
可通过 Unity 内置宏统一完成**阴影计算**与**光源衰减**逻辑编写。
```glsl
Pass
{
    Tags {"LightMode" = "ForwardBase"}//可计算主平行光的阴影
    CGPROGRAM
    #pragma vertex vert
    #pragma fragment frag
    #pragma multi_compile_fwdbase

    #include "Lighting.cginc"
    #include "AutoLight.cginc"//计算阴影时使用的宏来自于这个文件

    fixed3 _Color;
    fixed3 _Specular;
    fixed _Gloss;

    struct a2v
    {
        float4 vertex : POSITION;
        float3 normal:NORMAL;
    };

    struct v2f
    {
        float4 pos : SV_POSITION;
        float3 worldPos:TEXCOORD0;
        float3 worldNormal:TEXCOORD1;
        SHADOW_COORDS(2)//声明对阴影纹理采样的坐标_ShadowCoord，2指的是下一个可用的插值寄存器的索引值
    };

    v2f vert (a2v v)
    {
        v2f o;
        o.pos = UnityObjectToClipPos(v.vertex);
        o.worldPos=mul(unity_ObjectToWorld,v.vertex).xyz;
        o.worldNormal=UnityObjectToWorldNormal(v.vertex);
        TRANSFER_SHADOW(o);//计算v2f中声明的阴影纹理坐标：传统阴影映射(shadow map)：把顶点从模型空间转到光源空间；屏幕空间阴影：_ShadowCoord=computeScreenPos
        return o;
    }

    fixed4 frag (v2f i) : SV_Target
    {
        float3 worldNormal=normalize(i.worldNormal);
        float3 worldLightDir=normalize(UnityWorldSpaceLightDir(i.worldPos));
        float3 worldViewDir=normalize(UnityWorldSpaceViewDir(i.worldPos));
        float3 halfDir=normalize(worldLightDir+worldViewDir);

        fixed3 ambient=UNITY_LIGHTMODEL_AMBIENT.xyz*_Color.rgb;
        fixed3 diffuse=_LightColor0.rgb*_Color.rgb*saturate(dot(worldLightDir,worldNormal));
        fixed3 specular=_LightColor0.rgb*_Specular.rgb*pow(saturate(dot(worldNormal,halfDir)),_Gloss);
        //fixed atten=1.0;
        //fixed shadow=SHADOW_ATTENUATION(i);//使用_ShadowCoord对阴影纹理进行采样，得到阴影信息
        UNITY_LIGHT_ATTENUATION(atten,i,i.worldPos);//UNITY_LIGHT_ATTENUATION（destName,input,worldPos）是Unity内置的用于计算光照衰减和阴影的宏。它会将光照衰减和阴影值相乘后存储到第一个参数中，atten是宏内部声明的。内部调用SHADOW_ATTENUATION计算阴影，所以需要传递v2f结构体。worldPos用于计算衰减。
        return fixed4(ambient+(diffuse+specular)*atten,1.0);
    }
    ENDCG
}
```

## 透明度测试物体投射阴影的实现
如果仅是依赖于`FallBack`中的`ShadowCaster` Pass，则由于`ForwardBase`中进行了片元剔除，但阴影中没有执行相同的剔除逻辑，而是对模型的每个顶点都进行空间转换，然后写入shadow map。等其他物体采样这个shadow map时，自然得到的就是完整模型的深度信息。
![BQACAgUAAyEGAASHRsPbAAEVewZqLoVsyk-np61_2-rii89pwBJ8-wACxCUAAhZseFWpw2ZH9UQJ7DwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEVewZqLoVsyk-np61_2-rii89pwBJ8-wACxCUAAhZseFWpw2ZH9UQJ7DwE.png)
```glsl
Shader "Unlit/Chapter9-AlphaTestWithShadow"
{
    Properties
    {
        _Color ("Color Tint",Color) = (1,1,1,1)
        _MainTex ("MainTex",2D) = "white"{}
        _Specular ("Specular",Color) = (1,1,1,1)
        _Gloss ("Gloss",Range(8,256)) = 20
        _Cutoff ("Cutoff",Range(0,1)) = 0.5
    }
    SubShader
    {
        Pass
        {
            Tags {"RenderType" = "TransparentCutout" "IgnoreProjector" = "True" "Queue" = "AlphaTest" "LightMode" = "ForwardBase"}
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag

            #include "Lighting.cginc"

            fixed3 _Color;
            sampler2D _MainTex;
            float4 _MainTex_ST;
            fixed3 _Specular;
            fixed _Gloss;
            fixed _Cutoff;

            struct a2v
            {
                float4 vertex : POSITION;
                float2 texcoord : TEXCOORD0;
                float3 normal:NORMAL;
            };

            struct v2f
            {
                float2 uv : TEXCOORD0;
                float4 pos : SV_POSITION;
                float3 worldNormal:TEXCOORD1;
                float3 worldPos:TEXCOORD2;
            };

            v2f vert (a2v v)
            {
                v2f o;
                o.pos = UnityObjectToClipPos(v.vertex);
                o.uv = TRANSFORM_TEX(v.texcoord, _MainTex);
                o.worldNormal=UnityObjectToWorldNormal(v.normal);
                o.worldPos=mul(unity_ObjectToWorld,v.vertex).xyz;
                return o;
            }

            fixed4 frag (v2f i) : SV_Target
            {
                float3 worldNormal=normalize(i.worldNormal);
                float3 worldLightDir=normalize(UnityWorldSpaceLightDir(i.worldPos));
                float3 worldViewDir=normalize(UnityWorldSpaceViewDir(i.worldPos));
                float3 halfDir=normalize(worldLightDir+worldViewDir);//半角向量是视线方向和光线方向

                fixed4 texColor=tex2D(_MainTex,i.uv);
                clip(texColor.a-_Cutoff);
                fixed3 albedo=texColor.rgb*_Color.rgb;
                fixed3 ambient=UNITY_LIGHTMODEL_AMBIENT.xyz*albedo;
                fixed3 diffuse=_LightColor0.rgb*albedo*saturate(dot(worldNormal,worldLightDir));
                fixed3 specular=_LightColor0.rgb*_Specular*pow(saturate(dot(halfDir,worldNormal)),_Gloss);//高光计算是半角向量和法线方向
                return fixed4(ambient+diffuse+specular,1.0);
            }
            ENDCG
        }
    }
    FallBack "Specular"
}
```
如果要生成与物体一致的镂空的阴影，则需要手写`ShadowCaster` Pass。
![BQACAgUAAyEGAASHRsPbAAEVewdqLoWY-g5rfrMpu6pe_nRQVpEq_AACyiUAAhZseFXc3Syi1B0h4DwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEVewdqLoWY-g5rfrMpu6pe_nRQVpEq_AACyiUAAhZseFXc3Syi1B0h4DwE.png)
```glsl
Shader "Unlit/Chapter9-AlphaTestWithShadow"
{
    Properties
    {
        _Color ("Color Tint",Color) = (1,1,1,1)
        _MainTex ("MainTex",2D) = "white"{}
        _Specular ("Specular",Color) = (1,1,1,1)
        _Gloss ("Gloss",Range(8,256)) = 20
        _Cutoff ("Cutoff",Range(0,1)) = 0.5
    }
    SubShader
    {
        Pass
        {
            Tags {"RenderType" = "TransparentCutout" "IgnoreProjector" = "True" "Queue" = "AlphaTest" "LightMode" = "ForwardBase"}
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag

            #include "Lighting.cginc"

            fixed3 _Color;
            sampler2D _MainTex;
            float4 _MainTex_ST;
            fixed3 _Specular;
            fixed _Gloss;
            fixed _Cutoff;

            struct a2v
            {
                float4 vertex : POSITION;
                float2 texcoord : TEXCOORD0;
                float3 normal:NORMAL;
            };

            struct v2f
            {
                float2 uv : TEXCOORD0;
                float4 pos : SV_POSITION;
                float3 worldNormal:TEXCOORD1;
                float3 worldPos:TEXCOORD2;
            };

            v2f vert (a2v v)
            {
                v2f o;
                o.pos = UnityObjectToClipPos(v.vertex);
                o.uv = TRANSFORM_TEX(v.texcoord, _MainTex);
                o.worldNormal=UnityObjectToWorldNormal(v.normal);
                o.worldPos=mul(unity_ObjectToWorld,v.vertex).xyz;
                return o;
            }

            fixed4 frag (v2f i) : SV_Target
            {
                float3 worldNormal=normalize(i.worldNormal);
                float3 worldLightDir=normalize(UnityWorldSpaceLightDir(i.worldPos));
                float3 worldViewDir=normalize(UnityWorldSpaceViewDir(i.worldPos));
                float3 halfDir=normalize(worldLightDir+worldViewDir);//半角向量是视线方向和光线方向

                fixed4 texColor=tex2D(_MainTex,i.uv);
                clip(texColor.a-_Cutoff);
                fixed3 albedo=texColor.rgb*_Color.rgb;
                fixed3 ambient=UNITY_LIGHTMODEL_AMBIENT.xyz*albedo;
                fixed3 diffuse=_LightColor0.rgb*albedo*saturate(dot(worldNormal,worldLightDir));
                fixed3 specular=_LightColor0.rgb*_Specular*pow(saturate(dot(halfDir,worldNormal)),_Gloss);//高光计算是半角向量和法线方向
                return fixed4(ambient+diffuse+specular,1.0);
            }
            ENDCG
        }

        Pass{
            Tags {"LightMode" = "ShadowCaster"}
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile_shadowcaster

            #include "Lighting.cginc"

            sampler2D _MainTex;
            float4 _MainTex_ST;
            fixed _Cutoff;

            struct v2f{
                float2 uv:TEXCOORD0;
                V2F_SHADOW_CASTER;
            };

            v2f vert(appdata_base v){
                v2f o;
                o.uv=TRANSFORM_TEX(v.texcoord,_MainTex);
                TRANSFER_SHADOW_CASTER_NORMALOFFSET(o)
                return o;
            }

            float4 frag(v2f i):SV_Target{
                clip(tex2D(_MainTex, i.uv).a - _Cutoff);//增加与Base Pass片元着色器中一样的片元剔除逻辑
                SHADOW_CASTER_FRAGMENT(i)
            }
            ENDCG
        }
    }
    FallBack "VertexLit"
}
```
但幸运的是，unity已经为我们提供了适用于透明度测试物体的阴影生成的Unity Shader。只需把`FallBack`改成`Transparent/Cutout/VertexLit`即可。
![BQACAgUAAyEGAASHRsPbAAEVewlqLoW1Sk1USJc67U1dPOzUK2vHNwACzSUAAhZseFVMk_B9fVZ14jwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEVewlqLoW1Sk1USJc67U1dPOzUK2vHNwACzSUAAhZseFVMk_B9fVZ14jwE.png)
```glsl
Shader "Unlit/Chapter9-AlphaTestWithShadow"
{
    Properties
    {
        _Color ("Color Tint",Color) = (1,1,1,1)
        _MainTex ("MainTex",2D) = "white"{}
        _Specular ("Specular",Color) = (1,1,1,1)
        _Gloss ("Gloss",Range(8,256)) = 20
        _Cutoff ("Cutoff",Range(0,1)) = 0.5
    }
    SubShader
    {
        Pass
        {
            Tags {"RenderType" = "TransparentCutout" "IgnoreProjector" = "True" "Queue" = "AlphaTest" "LightMode" = "ForwardBase"}
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag

            #include "Lighting.cginc"

            fixed3 _Color;
            sampler2D _MainTex;
            float4 _MainTex_ST;
            fixed3 _Specular;
            fixed _Gloss;
            fixed _Cutoff;

            struct a2v
            {
                float4 vertex : POSITION;
                float2 texcoord : TEXCOORD0;
                float3 normal:NORMAL;
            };

            struct v2f
            {
                float2 uv : TEXCOORD0;
                float4 pos : SV_POSITION;
                float3 worldNormal:TEXCOORD1;
                float3 worldPos:TEXCOORD2;
            };

            v2f vert (a2v v)
            {
                v2f o;
                o.pos = UnityObjectToClipPos(v.vertex);
                o.uv = TRANSFORM_TEX(v.texcoord, _MainTex);
                o.worldNormal=UnityObjectToWorldNormal(v.normal);
                o.worldPos=mul(unity_ObjectToWorld,v.vertex).xyz;
                return o;
            }

            fixed4 frag (v2f i) : SV_Target
            {
                float3 worldNormal=normalize(i.worldNormal);
                float3 worldLightDir=normalize(UnityWorldSpaceLightDir(i.worldPos));
                float3 worldViewDir=normalize(UnityWorldSpaceViewDir(i.worldPos));
                float3 halfDir=normalize(worldLightDir+worldViewDir);//半角向量是视线方向和光线方向

                fixed4 texColor=tex2D(_MainTex,i.uv);
                clip(texColor.a-_Cutoff);
                fixed3 albedo=texColor.rgb*_Color.rgb;
                fixed3 ambient=UNITY_LIGHTMODEL_AMBIENT.xyz*albedo;
                fixed3 diffuse=_LightColor0.rgb*albedo*saturate(dot(worldNormal,worldLightDir));
                fixed3 specular=_LightColor0.rgb*_Specular*pow(saturate(dot(halfDir,worldNormal)),_Gloss);//高光计算是半角向量和法线方向
                return fixed4(ambient+diffuse+specular,1.0);
            }
            ENDCG
        }
    }
    FallBack "Transparent/Cutout/VertexLit"
}
```
但这样的效果仍然有些问题：默认情况下渲染到shadow map中的是物体的正面。如果模型的正面被剔除，那么光线可透过，不形成阴影。但是如果背面仍存在，会遮挡光线，实际上应该形成阴影
![BQACAgUAAyEGAASHRsPbAAEVewpqLoXR8y4WZDzdT3KaDUDznjAyEAAC0SUAAhZseFUsakvP54up_TwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEVewpqLoXR8y4WZDzdT3KaDUDznjAyEAAC0SUAAhZseFUsakvP54up_TwE.png)
。**解决**：将模型的`cast shadows`改为`two sided`即可。
![BQACAgUAAyEGAASHRsPbAAEVewtqLoXnVQEKvI9Ok0i3GO3JFZcTKgAC1SUAAhZseFWWJ6LxZ41qJTwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEVewtqLoXnVQEKvI9Ok0i3GO3JFZcTKgAC1SUAAhZseFWWJ6LxZ41qJTwE.png)

## 透明度混合物体阴影实现
unity不支持实现透明度混合物体的阴影效果（包括投射阴影和接收阴影），因为要投射阴影，需要有`ShadowCaster Pass`，这个pass要求深度写入，而透明度混合必须要求深度写入关闭，如果强制开启深度写入，需要在渲染每个光源的shadow map时，严格遵循从后往前的渲染顺序。
![BQACAgUAAyEGAASHRsPbAAEVew5qLoYjn7vzYeUEupAmeMui_O8OsgAC2yUAAhZseFXiEmxbAAGqX1I8BA.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEVew5qLoYjn7vzYeUEupAmeMui_O8OsgAC2yUAAhZseFXiEmxbAAGqX1I8BA.png)
```glsl
Shader "Unlit/Chapter9-AlphaTestWithShadow"
{
    Properties
    {
        _Color ("Color Tint",Color) = (1,1,1,1)
        _MainTex ("MainTex",2D) = "white"{}
        _Specular ("Specular",Color) = (1,1,1,1)
        _Gloss ("Gloss",Range(8,256)) = 20
        _AlphaScale ("AlphaScale",Range(0,1)) = 0.5
    }
    SubShader
    {
        Pass
        {
            Tags {"RenderType" = "Transparent" "IgnoreProjector" = "True" "Queue" = "Transparent" "LightMode" = "ForwardBase"}
            Blend SrcAlpha OneMinusSrcAlpha
            ZWrite Off
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile_fwdbase

            #include "Lighting.cginc"
            #include "AutoLight.cginc"

            fixed3 _Color;
            sampler2D _MainTex;
            float4 _MainTex_ST;
            fixed3 _Specular;
            fixed _Gloss;
            fixed _AlphaScale;

            struct a2v
            {
                float4 vertex : POSITION;
                float2 texcoord : TEXCOORD0;
                float3 normal:NORMAL;
            };

            struct v2f
            {
                float2 uv : TEXCOORD0;
                float4 pos : SV_POSITION;
                float3 worldNormal:TEXCOORD1;
                float3 worldPos:TEXCOORD2;
                SHADOW_COORDS(3)
            };

            v2f vert (a2v v)
            {
                v2f o;
                o.pos = UnityObjectToClipPos(v.vertex);
                o.uv = TRANSFORM_TEX(v.texcoord, _MainTex);
                o.worldNormal=UnityObjectToWorldNormal(v.normal);
                o.worldPos=mul(unity_ObjectToWorld,v.vertex).xyz;
                TRANSFER_SHADOW(o);
                return o;
            }

            fixed4 frag (v2f i) : SV_Target
            {
                float3 worldNormal=normalize(i.worldNormal);
                float3 worldLightDir=normalize(UnityWorldSpaceLightDir(i.worldPos));
                float3 worldViewDir=normalize(UnityWorldSpaceViewDir(i.worldPos));
                float3 halfDir=normalize(worldLightDir+worldViewDir);//半角向量是视线方向和光线方向

                fixed4 texColor=tex2D(_MainTex,i.uv);
                fixed3 albedo=texColor.rgb*_Color.rgb;
                fixed3 ambient=UNITY_LIGHTMODEL_AMBIENT.xyz*albedo;
                fixed3 diffuse=_LightColor0.rgb*albedo*saturate(dot(worldNormal,worldLightDir));
                fixed3 specular=_LightColor0.rgb*_Specular*pow(saturate(dot(halfDir,worldNormal)),_Gloss);//高光计算是半角向量和法线方向
                UNITY_LIGHT_ATTENUATION(atten,i,i.worldPos);
                return fixed4(ambient+(diffuse+specular)*atten,texColor.a*_AlphaScale);
            }
            ENDCG
        }

        
    }
    FallBack "Transparent/VertexLit"//透明度混合的内置FallBack，但不会投射阴影和接收阴影
}
```
将上述代码的FallBack改成”VertexLit”，将透明度混合物体当成不透明物体处理，可以让其投射虚假阴影和接收阴影。
![BQACAgUAAyEGAASHRsPbAAEVexFqLoZEu2hcgaT-5OI1ubBEDRhRPgAC3iUAAhZseFWyWY1XWgVzDzwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEVexFqLoZEu2hcgaT-5OI1ubBEDRhRPgAC3iUAAhZseFWyWY1XWgVzDzwE.png)
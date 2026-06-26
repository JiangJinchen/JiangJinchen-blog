---
title: 高级纹理
published: 2026-06-14
description: '《Unity Shader 入门精要》第10章'
image: ''
tags: [Unity]
category: '学习笔记/Unity Shader 入门精要'
draft: false 
lang: 'zh'
---
# 立方体纹理
## 主要用途
### 1. 天空盒子
将立方体纹理的六个面作为天空盒素材，直接用作整个场景的背景。

### 2. 环境映射纹理
可用于实现反射、折射等效果，**共有三种生成方式**：
1. 选用特殊布局的纹理，将其 `Texture Type` 设置为 `Cubemap`；
2. 新建立方体纹理资源，依次为六个面单独赋值贴图；
3. 通过脚本动态生成。

前两种方式需要提前准备纹理资源，且场景内所有物体共用同一份环境映射纹理；
第三种方式可根据物体所在位置，生成差异化的环境映射纹理。

**脚本生成原理**：在物体所在位置临时创建相机，以该相机视角向六个方向渲染整个场景，将渲染结果存入立方体纹理，完成后销毁临时相机。

## 反射与折射实现逻辑
获取环境映射立方体纹理后，可基于它实现反射、折射效果。
- **反射**：根据物体表面的**反射方向**采样立方体纹理。
```glsl
Shader "Unlit/Chapter10-Reflection"
{
    Properties
    {
        _Color ("Color Tint",Color) = (1,1,1,1)
        _ReflectColor ("Reflection Color",Color) = (1,1,1,1)
        _ReflectAmount ("Reflection Amount",Range(0,1)) = 1
        _Cubemap ("Reflection Cubemap",Cube) = "_Skybox" {}//Cubemap资源，事先使用脚本生成
    }
    SubShader
    {

        Pass
        {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag

            #include "Lighting.cginc"
            #include "AutoLight.cginc"

            fixed3 _Color;
            fixed3 _ReflectColor;
            fixed _ReflectAmount;
            samplerCUBE _Cubemap;

            struct a2v
            {
                float4 vertex : POSITION;
                float3 normal:NORMAL;
            };

            struct v2f
            {
                float4 pos : SV_POSITION;
                float3 worldNormal:TEXCOORD0;
                float3 worldPos:TEXCOORD1;
                float3 worldViewDir:TEXCOORD2;
                float3 worldRefl:TEXCOORD3;
                SHADOW_COORDS(4)
            };

            v2f vert (a2v v)
            {
                v2f o;
                o.pos = UnityObjectToClipPos(v.vertex);
                o.worldNormal = UnityObjectToWorldNormal(v.normal);
                o.worldPos = mul(unity_ObjectToWorld,v.vertex).xyz;
                o.worldViewDir = UnityWorldSpaceViewDir(o.worldPos);
                o.worldRefl = reflect(-o.worldViewDir,o.worldNormal);
                TRANSFER_SHADOW(o);
                return o;
            }

            fixed4 frag (v2f i) : SV_Target
            {
                float3 worldNormal = normalize(i.worldNormal);
                float3 worldLightDir = normalize(UnityWorldSpaceLightDir(i.worldPos));
                float3 worldViewDir = normalize(i.worldViewDir);

                fixed3 ambient = UNITY_LIGHTMODEL_AMBIENT.xyz;
                fixed3 diffuse = _LightColor0.rgb*_Color.rgb*saturate(dot(worldLightDir,worldNormal));
                fixed3 reflect = texCUBE(_Cubemap,i.worldRefl).rgb*_ReflectColor.rgb;

                UNITY_LIGHT_ATTENUATION(atten,i,i.worldPos);

                fixed3 color = ambient+lerp(diffuse,reflect,_ReflectAmount)*atten;
                return fixed4(color,1.0);
            }
            ENDCG
        }
    }
}
```
- **折射**：通过公式计算光线折射角度，依据**折射方向**采样立方体纹理。
根据折射定律，计算光线从介质1以入射角$\theta_1$斜射入介质2时，折射光线与法线的夹角 $\theta_2$，再使用该折射方向对立方体纹理采样。
从物理层面来说，完整效果需要计算光线在物体内部反弹、二次出射后的方向，再进行采样；但二次折射方向计算复杂度较高。仅模拟**单次折射**，也能得到不错的视觉表现，因此工程中常采用该简化方案。
![BQACAgUAAyEGAASHRsPbAAEVeyhqLoiBAAGzNDbEnP9zDo53RbZmLF8AAv8lAAIWbHhV9wHQLH0AARkMPAQ.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEVeyhqLoiBAAGzNDbEnP9zDo53RbZmLF8AAv8lAAIWbHhV9wHQLH0AARkMPAQ.png)
```glsl
Shader "Unlit/Chapter10-Refraction"
{
    Properties
    {
        _Color ("Color Tint",Color) = (1,1,1,1)
        _RefractColor ("Refraction Color",Color) = (1,1,1,1)
        _RefractAmount ("Refraction Amount",Range(0,1)) = 1
        _RefractRatio ("Refraction Ratio",Range(0.1,1)) = 0.5
        _Cubemap ("Refraction Cubemap",Cube) = "_Skybox"{}
    }
    SubShader
    {
        Pass
        {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag

            #include "Lighting.cginc"
            #include "AutoLight.cginc"

            fixed3 _Color;
            fixed3 _RefractColor;
            fixed _RefractAmount;
            fixed _RefractRatio;
            samplerCUBE _Cubemap;

            struct a2v
            {
                float4 vertex : POSITION;
                float3 normal : NORMAL;
            };

            struct v2f
            {
                float4 pos : SV_POSITION;
                float3 worldPos : TEXCOORD0;
                float3 worldNormal : TEXCOORD1;
                float3 worldViewDir : TEXCOORD2;
                float3 worldRefr : TEXCOORD3;
                SHADOW_COORDS(4)
            };

            v2f vert (a2v v)
            {
                v2f o;
                o.pos = UnityObjectToClipPos(v.vertex);
                o.worldPos = mul(unity_ObjectToWorld,v.vertex).xyz;
                o.worldNormal = UnityObjectToWorldNormal(v.normal);
                o.worldViewDir = UnityWorldSpaceViewDir(o.worldPos);//从相机指向物体
                o.worldRefr = refract(normalize(-o.worldViewDir),normalize(o.worldNormal),_RefractRatio);//refract函数需要的视线方向是从物体指向相机
                TRANSFER_SHADOW(o);
                return o;
            }

            fixed4 frag (v2f i) : SV_Target
            {
                float3 worldNormal = normalize(i.worldNormal);
                float3 worldLightDir = normalize(UnityWorldSpaceLightDir(i.worldPos));

                fixed3 ambient = UNITY_LIGHTMODEL_AMBIENT.xyz;
                fixed3 diffuse = _LightColor0.rgb*_Color.rgb*saturate(dot(worldNormal,worldLightDir));
                fixed3 refraction = texCUBE(_Cubemap,i.worldRefr).rgb*_RefractColor.rgb;
                UNITY_LIGHT_ATTENUATION(atten,i,i.worldPos);
                fixed3 color = ambient+lerp(diffuse,refraction,_RefractAmount)*atten;
                return fixed4(color,1.0);
            }
            ENDCG
        }
    }
}
```

# 菲涅尔反射
菲涅尔反射描述的光学现象：光线照射到物体表面时，一部分光发生反射，另一部分光穿透表面进入物体内部，产生折射或散射。
- 视线方向与表面法线**近似垂直**时，反射效果最强，画面几乎只呈现反射内容；
- 视线方向与表面法线**近似重合**时，反射效果最弱，几乎看不到反射。

反射光与入射光的占比可通过菲涅尔等式计算，工程中普遍使用 **Schlick 近似公式**：
$$F(v,n)=F_0+(1-F_0)\times(1-v\cdot n)^5$$

## 公式解析
1. 物体**边缘区域**：视线方向 $v$ 与法线 $n$ 夹角接近 $90^\circ$，点积 $v\cdot n$ 趋近于 0，$F(v,n)$ 数值变大，反射效果增强。
2. 物体**中心区域**：视线方向 $v$ 与法线 $n$ 夹角接近 $0^\circ$，点积 $v\cdot n$ 趋近于 1，$F(v,n)$ 趋近于 $F_0$，反射效果减弱。

### 参数 $F_0$（基础反射系数）
$F_0$ 是视线与法线平行时，物体固有的最小反射比例，用于控制整体菲涅尔反射强度：
- $F_0$ 越大，物体整体反射效果越强；
- $F_0$ 越小，仅物体边缘反射效果明显。
不同材质对应的 $F_0$ 数值各不相同。

## 混合应用规则
利用菲涅尔系数混合**漫反射颜色**与**反射颜色**：
- 菲涅尔系数越大，最终颜色越偏向反射颜色；
- 菲涅尔系数越小，最终颜色越偏向物体自身漫反射颜色。
![BQACAgUAAyEGAASHRsPbAAEVezRqLon8_NDtlVOXX4mLuxlIyMOXDQACCyYAAhZseFW2idw4PSLepTwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEVezRqLon8_NDtlVOXX4mLuxlIyMOXDQACCyYAAhZseFW2idw4PSLepTwE.png)
```glsl
Shader "Unlit/Chapter10-Fresnel"
{
    Properties
    {
        _Color ("Color Tint",Color) = (1,1,1,1)
        _FresnelScale ("Fresnel Scale",Range(0,1)) = 0.5
        _Cubemap ("Reflection Cubemap",Cube) = "_Skybox"{}
    }
    SubShader
    {

        Pass
        {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag

            #include "Lighting.cginc"
            #include "AutoLight.cginc"
            fixed3 _Color;
            fixed _FresnelScale;
            samplerCUBE _Cubemap;

            struct a2v
            {
                float4 vertex : POSITION;
                float3 normal : NORMAL;
            };

            struct v2f
            {
                float4 pos : SV_POSITION;
                float3 worldPos : TEXCOORD0;
                float3 worldNormal : TEXCOORD1;
                float3 worldViewDir : TEXCOORD2;
                float3 worldRefl : TEXCOORD3;
                SHADOW_COORDS(4)
            };

            v2f vert (a2v v)
            {
                v2f o;
                o.pos = UnityObjectToClipPos(v.vertex);
                o.worldPos = mul(unity_ObjectToWorld,v.vertex).xyz;
                o.worldNormal = UnityObjectToWorldNormal(v.normal);
                o.worldViewDir = UnityWorldSpaceViewDir(o.worldPos);
                o.worldRefl = reflect(-o.worldViewDir,o.worldNormal);
                TRANSFER_SHADOW(o);
                return o;
            }

            fixed4 frag (v2f i) : SV_Target
            {
                float3 worldNormal = normalize(i.worldNormal);
                float3 worldLightDir = normalize(UnityWorldSpaceLightDir(i.worldPos));
                float3 worldViewDir = normalize(i.worldViewDir);

                fixed3 ambient = UNITY_LIGHTMODEL_AMBIENT.xyz;
                fixed3 diffuse = _LightColor0.rgb*_Color.rgb*saturate(dot(worldNormal,worldLightDir));
                fixed3 reflection = texCUBE(_Cubemap,i.worldRefl).rgb;
                fixed fresnel = _FresnelScale+(1-_FresnelScale)*pow(1-dot(worldViewDir,worldNormal),5);
                UNITY_LIGHT_ATTENUATION(atten,i,i.worldPos);
                fixed3 color = ambient+lerp(diffuse,reflection,saturate(fresnel))*atten;
                return fixed4(color,1.0);
            }
            ENDCG
        }
    }
}
```


# 渲染纹理
## Unity 实现镜面效果
1. 场景搭建：创建面片作为镜面载体，编写对应 Shader 制作镜面材质；额外新建一台**反射相机**，专门拍摄镜面成像内容。
2. 渲染流程：反射相机将画面渲染到**渲染纹理（Render Texture）**，镜面材质对该纹理采样，并在 X 轴做翻转处理。
3. 相机布局规则：主相机对应人眼视角，反射相机对应镜像视角，两台相机需**关于镜面对称**，且均朝向镜面。
4. 画面翻转原因：受相机对称布局影响，反射相机输出画面本身左右颠倒，因此需要在 Shader 中做 X 轴翻转修正。
5. 参数适配：为让渲染画面与镜面尺寸匹配，需要调整反射相机的**视野(FOV)**、近裁剪面、远裁剪面参数。
![BQACAgUAAyEGAASHRsPbAAEVezJqLonAcLB3yXuE-oubyszKHnl1HQACCSYAAhZseFXUcThBgtLWzTwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEVezJqLonAcLB3yXuE-oubyszKHnl1HQACCSYAAhZseFXUcThBgtLWzTwE.png)
```glsl
Shader "Unlit/Chapter10-Mirro"
{
    Properties
    {
        _MainTex ("Texture", 2D) = "white" {}
    }
    SubShader
    {

        Pass
        {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag

            #include "Lighting.cginc"

            struct a2v
            {
                float4 vertex : POSITION;
                float2 texcoord : TEXCOORD0;
            };

            struct v2f
            {
                float2 uv : TEXCOORD0;
                float4 pos : SV_POSITION;
            };

            sampler2D _MainTex;
            float4 _MainTex_ST;

            v2f vert (a2v v)
            {
                v2f o;
                o.pos = UnityObjectToClipPos(v.vertex);
                o.uv = v.texcoord;
                o.uv.x = 1-o.uv.x;
                return o;
            }

            fixed4 frag (v2f i) : SV_Target
            {
                return tex2D(_MainTex,i.uv);
            }
            ENDCG
        }
    }
}
```

## Unity 模拟玻璃效果
`GrabPass` 多用于**透明物体**渲染，这类物体本身无独立底色，仅改变后方已渲染物体的视觉效果。
渲染顺序：场景中所有不透明物体、背景渲染完成后，`GrabPass` 抓取当前屏幕图像，对图像做二次处理，最终用于透明物体着色。

### Shader 逻辑拆解
1. **基础效果：漫反射 + 法线纹理**
    - 为降低片元着色器计算开销，在**顶点着色器**中预计算**切线空间转世界空间**的变换矩阵，矩阵列向量依次对应世界空间下的切线、法线、副切线。
    - 利用插值器第四通道存储顶点世界坐标，提升数据利用率。
    - 法线贴图原始采样值为 `[0,1]` 区间的 RGBA 颜色，需通过内置函数 `UnpackNormal` 重映射至 `[-1,1]` 法线数据；该函数会先转换 xy 分量，再根据向量归一化特性推导 z 分量，最终得到**切线空间下的法线**。

2. **折射效果实现**
    - 依托 Cubemap 环境映射纹理，可通过脚本在物体位置动态生成 Cubemap 资源。
    - 原理：模拟光线穿透玻璃产生的画面扭曲，将屏幕采样坐标，沿**切线空间法线的二维投影方向**做像素级偏移。
    - 选择切线空间法线：更贴合顶点局部朝向；仅做二维偏移：屏幕采样坐标本身为二维，z 轴纵深无实际意义。
    - 流程：对偏移后的坐标执行透视除法，得到标准屏幕坐标，采样 `GrabPass` 抓取的屏幕纹理，输出折射颜色。

3. **反射效果实现**
    - 反射光线不穿透物体，无需偏移屏幕坐标。
    - 流程：将切线空间法线转换为世界空间法线，结合视线方向、法线方向计算反射方向，使用反射方向采样 Cubemap 得到环境反射色，最终反射色与漫反射色相乘。

4. **最终颜色混合**
    通过折射系数，对反射颜色、折射颜色做混合，输出玻璃最终像素颜色。

![BQACAgUAAyEGAASHRsPbAAEVezZqLopC0i6xyt19G2PAQJufS_vYdgACDSYAAhZseFXMZAQoH2HS-zwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEVezZqLopC0i6xyt19G2PAQJufS_vYdgACDSYAAhZseFXMZAQoH2HS-zwE.png)
```glsl
Shader "Unlit/Chapter10-GlassRefraction"
{
    Properties
    {
        _MainTex ("Main Tex",2D) = "white"{}
        _BumpMap ("Normal Map",2D) = "bump"{}
        _Cubemap ("Reflection Cubemap",Cube) = "_Skybox"{}
        _RefractAmount ("Refract Amount",Range(0,1)) = 1
        _Distortion ("Distortion",Range(0,100)) = 10
    }
    SubShader
    {
        Tags {"RenderType" = "Opaque" "Queue" = "Transparent"}//渲染的物体本身是不透明物体，所以renderType是不透明；但是物体要使用grabPass抓取到的图像，所以必须在所有不透明物体渲染之后，再抓取，所以渲染队列是透明
        //总结：RenderType由物体类型决定，Queue由物体渲染顺序决定
        GrabPass {"_RefractionTex"}//不显式声明名称，是每一个物体抓一次；显式声明名称，每一帧抓一次

        Pass
        {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag

            #include "Lighting.cginc"

            sampler2D _MainTex;
            float4 _MainTex_ST;
            sampler2D _BumpMap;
            float4 _BumpMap_ST;
            samplerCUBE _Cubemap;
            fixed _RefractAmount;
            float _Distortion;
            sampler2D _RefractionTex;
            float4 _RefractionTex_TexelSize;

            struct a2v
            {
                float4 vertex : POSITION;
                float2 texcoord : TEXCOORD0;
                float3 normal : NORMAL;
                float4 tangent : TANGENT;
            };

            struct v2f
            {
                float4 uv : TEXCOORD0;
                float4 pos : SV_POSITION;
                float4 scrPos : TEXCOORD1;
                float4 TtoW0 : TEXCOORD2;
                float4 TtoW1 : TEXCOORD3;
                float4 TtoW2 : TEXCOORD4;
            };

            v2f vert (a2v v)
            {
                v2f o;
                o.pos = UnityObjectToClipPos(v.vertex);
                o.uv.xy = TRANSFORM_TEX(v.texcoord,_MainTex);
                o.uv.zw = TRANSFORM_TEX(v.texcoord,_BumpMap);

                o.scrPos = ComputeGrabScreenPos(o.pos);

                float3 worldPos = mul(unity_ObjectToWorld,v.vertex).xyz;
                float3 worldTangent = UnityObjectToWorldDir(v.tangent.xyz);
                float3 worldNormal = UnityObjectToWorldNormal(v.normal);
                float3 worldBinormal = cross(worldTangent,worldNormal)*v.tangent.w;

                o.TtoW0 = float4(worldTangent.x,worldNormal.x,worldBinormal.x,worldPos.x);
                o.TtoW1 = float4(worldTangent.y,worldNormal.y,worldBinormal.y,worldPos.y);
                o.TtoW2 = float4(worldTangent.z,worldNormal.z,worldBinormal.z,worldPos.z);

                return o;
            }

            fixed4 frag (v2f i) : SV_Target
            {
                fixed3 texColor = tex2D(_MainTex,i.uv.xy).rgb;//漫反射颜色
                fixed3 bump = UnpackNormal(tex2D(_BumpMap,i.uv.zw)).rgb;//切线空间法线

                //折射效果
                float2 offset = bump.xy*_Distortion*_RefractionTex_TexelSize;
                i.scrPos.xy= i.scrPos.xy+offset;
                float2 uv = i.scrPos.xy/i.scrPos.w;
                fixed3 refrColor = tex2D(_RefractionTex,uv).rgb;

                //反射效果
                bump = normalize(half3(dot(i.TtoW0.xyz,bump),dot(i.TtoW1.xyz,bump),dot(i.TtoW2.xyz,bump)));//世界空间法线
                float3 worldPos = float3(i.TtoW0.w,i.TtoW1.w,i.TtoW2.w);
                float3 worldViewDir = normalize(UnityWorldSpaceViewDir(worldPos));
                float3 reflDir = reflect(-worldViewDir,bump);
                fixed3 reflColor = texCUBE(_Cubemap,reflDir).rgb*texColor;

                //混合输出颜色
                fixed3 finalColor = reflColor*(1-_RefractAmount)+refrColor*_RefractAmount;

                return fixed4(finalColor,1.0);
            }
            ENDCG
        }
    }
}
```

## Render Texture 与 GrabPass 效率对比
- **Render Texture**：分辨率可自定义，资源开销可控，整体渲染效率更高。
- **GrabPass**：默认分辨率等同于屏幕尺寸；且需要读取 GPU 帧缓存数据，**必须等待 GPU 完成写入后才能读取**。读取期间 CPU 无法下发新指令，GPU 也无法执行后续渲染任务，存在性能阻塞。

综上，**Render Texture 渲染效率优于 GrabPass**。

# 程序纹理
## 1. 代码生成程序纹理
通过 C# 脚本动态绘制纹理，再将生成的纹理赋值给材质的 `_MainTex`，最终由 Shader 采样并渲染物体。C# 脚本的核心作用就是生成纹理贴图。

### 脚本特性说明
- **`[ExecuteInEditMode]`**
  开启该特性后，在编辑器模式下调整纹理相关参数时，场景纹理可**实时预览变化**，无需运行游戏（普通 C# 脚本仅在运行后生效）。

- **`[SerializeField]`**
  脚本中将参数定义为**私有变量**（防止外部脚本随意修改），配合该特性可实现两个作用：
  1. 私有变量展示在 Inspector 面板，支持编辑器可视化调节；
  2. 开启序列化，Unity 会持久保存参数数值，重启工程后参数值不会重置。

- **属性 Set 方法**
  使用属性的 `Set` 访问器，在面板修改参数时自动调用 `_UpdateMaterial()` 方法，实时更新视口纹理。
  编辑器非运行状态下默认修改参数不会触发刷新，此处搭配插件实现完整实时更新（插件参考：https://zhuanlan.zhihu.com/p/37128524）。

### 核心执行流程
1. `_UpdateMaterial()`：调用内部私有方法完成纹理生成，并将纹理赋值给材质的 `_MainTex`；
2. 纹理生成逻辑：
   1. 创建空白纹理，定义图案绘制参数；
   2. 遍历纹理所有像素，先统一填充背景色；
   3. 嵌套循环绘制图案，根据每个像素到 9 个圆形的距离混合颜色，确定像素最终色值。
![BQACAgUAAyEGAASHRsPbAAEVfOJqLrX5SudAQH-jA6UhA4ozZiPT9gACdisAAhZseFX3M7xxP50DJjwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEVfOJqLrX5SudAQH-jA6UhA4ozZiPT9gACdisAAhZseFX3M7xxP50DJjwE.png)
```C#
using System.Collections;
using System.Collections.Generic;
using UnityEngine;

[ExecuteInEditMode]
public class ProceduralTextureGeneration : MonoBehaviour
{
    public Material material = null;

    #region Material properties//仅仅为了组织代码（代码编辑器可以折叠起来），无实际意义
    [SerializeField, SetProperty("textureWidth")]
    private int m_textureWidth = 512;
    public int textureWidth
    {
        get
        {
            return m_textureWidth;
        }
        set
        {
            m_textureWidth = value;
            _UpdateMaterial();
        }
    }

    [SerializeField, SetProperty("backgroundColor")]
    private Color m_backgroundColor = Color.white;
    public Color backgroundColor
    {
        get
        {
            return m_backgroundColor;
        }
        set
        {
            m_backgroundColor = value;
            _UpdateMaterial();
        }
    }

    [SerializeField, SetProperty("circleColor")]
    private Color m_circleColor = Color.white;
    public Color circleColor
    {
        get
        {
            return m_circleColor;
        }
        set
        {
            m_circleColor = value;
            _UpdateMaterial();
        }
    }

    [SerializeField, SetProperty("blurFactor")]
    private float m_blurFactor = 2.0f;
    public float blurFactor
    {
        get
        {
            return m_blurFactor;
        }
        set
        {
            m_blurFactor = value;
            _UpdateMaterial();
        }
    }
    #endregion

    private Texture2D m_generatedTexture = null;
    // Start is called before the first frame update
    void Start()
    {
        if(material == null)
        {
            Renderer renderer = gameObject.GetComponent<Renderer>();
            if(renderer == null)
            {
                Debug.LogWarning("Cannot find a renderer.");
                return;
            }
            material = renderer.sharedMaterial;
            _UpdateMaterial();
        }
    }
    private void _UpdateMaterial()
    {
        if(material != null)
        {
            m_generatedTexture = _GenerateProceduralTexture();
            material.SetTexture("_MainTex", m_generatedTexture);
        }
    }
    private Texture2D _GenerateProceduralTexture()
    {
        Texture2D proceduralTexture = new Texture2D(textureWidth, textureWidth);
        float circleInterval = textureWidth / 4.0f;
        float radius = textureWidth / 10.0f;
        float edgeBlur = 1.0f / blurFactor;
        for(int w = 0;w < textureWidth; w++)
        {
            for(int h = 0; h < textureWidth; h++)
            {
                Color pixel = backgroundColor;
                for(int i = 0; i < 3; i++)
                {
                    for (int j = 0; j < 3; j++)
                    {
                        Vector2 circleCenter = new Vector2(circleInterval * (i + 1), circleInterval * (j + 1));
                        float dist = Vector2.Distance(new Vector2(w, h), circleCenter) - radius;
                        Color color = _MixColor(circleColor, new Color(pixel.r, pixel.g, pixel.b, 0.0f), Mathf.SmoothStep(0f, 1.0f, dist * edgeBlur));
                        pixel = _MixColor(pixel, color, color.a);
                    }
                }
                proceduralTexture.SetPixel(w, h, pixel);
            }
        }
        proceduralTexture.Apply();
        return proceduralTexture;
    }
    private Color _MixColor(Color a, Color b, float t)
    {
        return Color.Lerp(a, b, t);
    }

    // Update is called once per frame
    void Update()
    {
        
    }
}
```

## 2. 使用外部程序材质
程序材质与程序纹理不在 Unity 内制作，而是借助 **Substance Designer（SD）** 设计，流程如下：
1. 在 Substance Designer 中制作纹理/材质，**暴露可调节参数**（供 Unity 内修改），导出为 `sbsar` 格式资源；
2. 在 Unity 中安装 `Substance 3D for Unity` 配套插件；
3. 将 `sbsar` 文件导入 Unity 项目窗口，引擎会自动解析并生成：Substance 资源、材质球、多张纹理贴图；
4. 选中 `sbsar` 资源，在 Inspector 面板选择对应程序材质（单个 `sbsar` 可包含多套程序材质），自由调节暴露参数；
5. 将生成的材质赋予模型，默认使用 `Standard` 标准着色器。

# 纹理动画
## 1. 序列帧动画
准备一张整合多帧画面的序列图集，借助**时间变量**对 UV 坐标做偏移，快速切换图集内不同子图，从而形成动画效果。
![BQACAgUAAyEGAASHRsPbAAEVfPlqLrgQs3J95IjDekSo4uQfCCnSHQACjysAAhZseFUJ4v9G9RaXczwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEVfPlqLrgQs3J95IjDekSo4uQfCCnSHQACjysAAhZseFUJ4v9G9RaXczwE.png)
```glsl
Shader "Unlit/Chapter11-ImageSequenceAnimation"
{
    Properties
    {
    _Color ("Color Tint",Color) = (1,1,1,1)    
    _MainTex ("Image Sequence", 2D) = "white" {}
    _HorizontalAmount ("Horizontal Amount",Float) = 4//每行有几帧小图
    _VerticalAmount ("Vertical Amount",Float) = 4//每列有几帧小图
    _Speed ("Speed",Range(1,100)) = 30
    }
    SubShader
    {
        Tags { "RenderType"="Transparent" "Queue" = "Transparent" "IgnoreProjector" = "True" }//关键帧图像_MainTex通常是透明纹理，因此被当作一个半透明对象

        Pass
        {
            Tags {"LightMode" = "ForwardBase"}//为什么需要声明渲染模式
            ZWrite Off
            Blend SrcAlpha OneMinusSrcAlpha//关闭深度写入和声明混合模式都是渲染透明度混合物体的标配
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag

            #include "Lighting.cginc"

            struct a2v
            {
                float4 vertex : POSITION;
                float2 texcoord : TEXCOORD0;
            };

            struct v2f
            {
                float2 uv : TEXCOORD0;
                float4 pos : SV_POSITION;
            };

            fixed3 _Color;
            sampler2D _MainTex;
            float4 _MainTex_ST;
            float _HorizontalAmount;
            float _VerticalAmount;
            float _Speed;

            v2f vert (a2v v)
            {
                v2f o;
                o.pos = UnityObjectToClipPos(v.vertex);
                o.uv = TRANSFORM_TEX(v.texcoord, _MainTex);
                return o;
            }

            fixed4 frag (v2f i) : SV_Target
            {
                float offset = floor(_Time.y*_Speed);//_Speed是每秒多少帧，_Time.y是游戏运行时间，二者相乘得到当前应该播放第几帧
                //计算当前帧在序列帧图像的第几行、第几列
                float row = floor(offset/_HorizontalAmount);//总帧数/一行有多少帧=行数
                float column = offset - row*_HorizontalAmount;//总帧数%一行有多少帧=列数<=>总帧数-行数*每行的帧数=剩余的这一行的帧数=这一行的列数

                half2 uv = float2(i.uv.x / _HorizontalAmount,i.uv.y / _VerticalAmount);//计算第一帧开始时的UV坐标（整张序列帧的UV范围是0-1，但每次只需移动其中一个小图，所以先把UV缩放到左上角第一个小图的起始处）
                uv.x += column / _HorizontalAmount;//从第一个小图开始偏移row行、column列
                uv.y -= row / _VerticalAmount;//往下偏移row行，因为Unity中纹理坐标原点在左下角，从下往上增大；序列帧纹理（美术）原点在左上角，从上往下增大。现在是往序列帧纹理的下方偏移，所以对uv来说是减小
                //half2 uv = i.uv + half2(column,-row);//这种写法是把uv的+-操作统一起来表示
                //uv.x /= _HorizontalAmount;
                //uv.y /= _VerticalAmount;

                fixed4 c = tex2D(_MainTex,uv);//使用偏移后的uv采样_MainTex
                c.rgb*=_Color;//需要乘上物体本来的颜色
                return c;
            }
            ENDCG
        }
    }
    Fallback "Transparent/VertexLit"//半透明物体的Fallback
}
```
## 2. 背景滚动
采用**双层背景**实现无限滚动视差效果：
- 远景层：滚动速度慢
- 近景层：滚动速度快

实现逻辑：
1. 定义两层纹理各自的水平滚动速度；
2. 通过 `_Time.y` 计算累计滚动量，使用 `frac` 函数仅保留小数部分作为 UV 偏移值，叠加到原始 UV 坐标；
3. 分别使用两组 UV 采样两层纹理；
4. 利用近景纹理的透明度混合两层画面，再结合亮度参数调节，输出最终颜色。
![BQACAgUAAyEGAASHRsPbAAEVfPpqLrhHIQdBVbn459akYCWWPFN24QACkCsAAhZseFVcM5scAAHhcfI8BA.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEVfPpqLrhHIQdBVbn459akYCWWPFN24QACkCsAAhZseFVcM5scAAHhcfI8BA.png)
```glsl
Shader "Unlit/Chapter11-ScrollingBackground"
{
    Properties
    {
        _MainTex ("Base Layer(RGB)",2D) = "white"{}//第一层（较远）纹理
        _DetailTex ("2nd Layer(RGB)",2D) = "white"{}//第二层（较近）纹理
        _ScrollX("Base layer Scroll Speed",Float) = 1.0//第一层纹理的水平滚动速度
        _Scroll2X("2nd layer Scroll Speed",Float) = 1.0//第二层纹理的水平滚动速度
        _Multiplier("Layer Multiplier",Float) = 1//纹理的整体亮度 美术需要、整体曝光
    }
    SubShader
    {

        Pass
        {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag

            #include "Lighting.cginc"

            sampler2D _MainTex;
            float4 _MainTex_ST;
            sampler2D _DetailTex;
            float4 _DetailTex_ST;
            float _ScrollX;
            float _Scroll2X;
            float _Multiplier;

            struct a2v
            {
                float4 vertex : POSITION;
                float4 texcoord : TEXCOORD0;
            };

            struct v2f
            {
                float4 uv : TEXCOORD0;
                float4 pos : SV_POSITION;
            };

            v2f vert (a2v v)
            {
                v2f o;
                o.pos = UnityObjectToClipPos(v.vertex);
                o.uv.xy = TRANSFORM_TEX(v.texcoord, _MainTex)+frac(float2(_ScrollX,0.0)*_Time.y);//TRANSFORM_TEX获得的是贴图固有的采样坐标（加了贴图缩放和偏移的影响）；_ScrollX*_Time.y是计算到目前为止，水平方向走了多少帧，这个值会随着_Time.y的增大而无限增大。又因为uv是二维坐标，所以需要将这个值转为二维向量，因为只是水平移动，所以y分量直接为0.且由于uv坐标是0-1，所以需要使用frac只取这个值的小数部分，将其限制在0-1之间，且无限循环滚动
                o.uv.zw = TRANSFORM_TEX(v.texcoord, _DetailTex)+frac(float2(_Scroll2X,0.0)*_Time.y);
                return o;
            }

            fixed4 frag (v2f i) : SV_Target
            {
                fixed4 firstLayer = tex2D(_MainTex,i.uv.xy);
                fixed4 secondLayer = tex2D(_DetailTex,i.uv.zw);
                fixed4 color = lerp(firstLayer,secondLayer,secondLayer.a);//近景是叠加在远景之上，近景中透明部分能够透出背景
                color.rgb*=_Multiplier;
                return color;
            }
            ENDCG
        }
    }
    Fallback "VertexLit"
}
```
## 3. 顶点动画
在**顶点着色器**中，结合时间、三角函数等修改顶点坐标，可搭配 UV 动画一同使用。主要分为两类实现方式：

### 3.1 形变类顶点动画
以**时间**为驱动源，修改顶点位置，模拟波浪、旗帜摆动、物体形变等物理效果。
![BQACAgUAAyEGAASHRsPbAAEVfPtqLrh3dmaIIUWJEAT3YhMrfWRvFAACkSsAAhZseFX9p3ONyXeUDjwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEVfPtqLrh3dmaIIUWJEAT3YhMrfWRvFAACkSsAAhZseFX9p3ONyXeUDjwE.png)
```glsl
Shader "Unlit/Chapter11-Water"
{
    Properties
    {
        _MainTex ("Texture", 2D) = "white" {}//河流的纹理，带透明通道，所以当作半透明物体
        _Color ("Color Tint",Color) = (1,1,1,1)//物体本身的颜色
        _Magnitude ("Distortion Magnitude",Float) = 1
        _Frequency ("Distortion Frequency",Float) = 1
        _InvWaveLength ("Distortion Inverse Wave Length",Float) = 1//上面三个变量都是用于实现顶点偏移
        _Speed ("Speed",Float) = 0.5//_MainTex的流动速度
    }
    SubShader
    {
        Tags { "RenderType"="Transparent" "Queue" = "Transparent" "IgnoreProjector" = "True" "DisableBatching" = "True" }//前三是透明度混合物体的三件套，第四是顶点动画需要禁用批处理。
        //因为批处理会把所有模型合并，每个模型各自的模型空间就会丢失，但顶点动画需要在模型空间对顶点位置进行偏移

        ZWrite Off
        Blend SrcAlpha OneMinusSrcAlpha
        Cull off//关闭背面剔除，使得河流面片的双面都可以渲染

        Pass
        {
            Tags {"LightMode" = "ForwardBase"}
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag

            #include "Lighting.cginc"

            sampler2D _MainTex;
            float4 _MainTex_ST;
            fixed3 _Color;
            float _Magnitude;
            float _Frequency;
            float _InvWaveLength;
            float _Speed;

            struct a2v
            {
                float4 vertex : POSITION;
                float2 uv : TEXCOORD0;
            };

            struct v2f
            {
                float2 uv : TEXCOORD0;
                float4 pos : SV_POSITION;
            };

            v2f vert (a2v v)
            {
                v2f o;
                float4 offset;
                //不太理解下面计算偏移的思路，按道理来说，面片在xz平面，上下波动，应该是偏移z，然后水流向前波动，应该是改变水平方向的u
                //只希望对顶点的x方向进行偏移，所以把yzw的偏移量都置为0
                offset.yzw = float3(0.0,0.0,0.0);
                offset.x = sin(_Frequency*_Time.y + v.vertex.x * _InvWaveLength + v.vertex.y * _InvWaveLength + v.vertex.z * _InvWaveLength)*_Magnitude;
                o.pos = UnityObjectToClipPos(v.vertex + offset);
                o.uv = TRANSFORM_TEX(v.uv, _MainTex);
                o.uv += float2(0.0,_Speed * _Time.y);//模拟向前流动的河水（从左到右）
                return o;
            }

            fixed4 frag (v2f i) : SV_Target
            {
                fixed4 color = tex2D(_MainTex,i.uv);
                color.rgb*=_Color.rgb;
                return color;
            }
            ENDCG
        }
    }
}
```
### 3.2 广告牌技术
以**相机**为驱动源，每帧动态调整面片四个顶点位置，保证面片始终朝向相机。

#### 实现难点
需要构建面片的三组正交基向量：表面法线、向上方向、向右方向，分两种实现方案：
1. **表面法线固定**
   由初始向上方向与法线做叉积得到向右方向并归一化，再用向右方向与法线叉积，重新计算正交的向上方向。
2. **向上方向固定为 (0,1,0)**
   由固定向上方向与法线做叉积得到向右方向并归一化，再用向右方向与固定向上方向叉积，重新计算正交的表面法线。
![BQACAgUAAyEGAASHRsPbAAEVfP5qLrjBmoC1tKDOyQ39tb7kjAZp9wAClCsAAhZseFWl4L5CKxEqRzwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEVfP5qLrjBmoC1tKDOyQ39tb7kjAZp9wAClCsAAhZseFWl4L5CKxEqRzwE.png)
![BQACAgUAAyEGAASHRsPbAAEVfQABai641r9S5-TXIIxR4gdvKFcfxrwAApYrAAIWbHhVoNXdqZBQD648BA.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEVfQABai641r9S5-TXIIxR4gdvKFcfxrwAApYrAAIWbHhVoNXdqZBQD648BA.png)
```glsl
Shader "Unlit/Chapter11-Billboard"
{
    Properties
    {
        _MainTex ("Texture", 2D) = "white" {}
        _Color ("Color Tint",Color) = (1,1,1,1)
        _VerticalBillboarding ("Vertical Resraints",Range(0,1)) = 1
    }
    SubShader
    {
        Tags { "RenderType"="Transparent" "Queue" = "Transparent" "IgnoreProjector" = "True" "DisableBatching" = "True" }
        
        ZWrite Off
        Blend SrcAlpha OneMinusSrcAlpha
        Cull Off

        Pass
        {
            Tags {"LightMode" = "ForwardBase"}
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag

            #include "Lighting.cginc"

            sampler2D _MainTex;
            float4 _MainTex_ST;
            fixed4 _Color;
            float _VerticalBillboarding;

            struct a2v
            {
                float4 vertex : POSITION;
                float2 texcoord : TEXCOORD0;
            };

            struct v2f
            {
                float2 uv : TEXCOORD0;
                float4 pos : SV_POSITION;
            };

            v2f vert (a2v v)
            {
                v2f o;
                float3 center = float3(0,0,0);//广告牌的锚点，模型空间的原点
                float3 viewer = mul(unity_WorldToObject,float4(_WorldSpaceCameraPos,1.0));//模型空间的相机位置
                float3 normalDir = viewer - center;//视线方向就是法线方向
                //如果_VerticalBillboarding = 1，表明固定法线方向，此时向上方向不重要（但不能和法线方向平行，否则叉积计算出的右方向为0）
                //如果_VerticalBillboarding = 0，表明固定向上方向为(0,1,0)，此时法线方向不重要
                //统一表示（非常巧妙！）
                normalDir.y = normalDir.y * _VerticalBillboarding;
                normalDir = normalize(normalDir);//三个方向向量都要求是单位向量即基向量

                float3 upDir = abs(normalDir.y)>0.999?float3(0,0,1):float3(0,1,0);
                float3 rightDir = normalize(cross(normalDir,upDir));
                upDir = normalize(cross(normalDir,rightDir));

                float3 centerOffs = v.vertex.xyz - center;//原始偏移量
                float3 localPos = center+centerOffs.x*rightDir+centerOffs.y*upDir+centerOffs.z*normalDir;//对竖直放置的面片，水平方向是x轴，是左右宽度；竖直方向是y轴，是上下高度；前后方向是z轴，是厚度。所以这个乘法关系不能变。也因此只能创建quad，不能是plane（水平放置，在xoz平面）
                o.pos = UnityObjectToClipPos(float4(localPos,1));
                o.uv = TRANSFORM_TEX(v.texcoord, _MainTex);
                return o;
            }

            fixed4 frag (v2f i) : SV_Target
            {
                fixed4 color = tex2D(_MainTex,i.uv);
                color.rgb*=_Color.rgb;
                return color;
            }
            ENDCG
        }
    }
    Fallback "Transparent/VertexLit"
}
```
---

### 顶点动画相关问题解答
#### Q1：顶点动画为什么需要禁用批处理？
A：顶点动画会在模型空间下对顶点坐标做偏移运算，合批会破坏顶点原始数据与变换逻辑，因此需要禁用批处理。

#### Q2：禁用批处理后 Draw Call 增多，为何会造成性能下降？
A：批处理可将符合条件的多个物体合并渲染，仅执行一次 Draw Call。而每次发起 Draw Call，CPU 都需要执行大量数据准备工作，开销较高；Draw Call 数量过多会显著增加 CPU 负担，导致性能下降。

#### Q3：广告牌技术如何优化，避免依赖模型空间绝对坐标/方向？
A：不使用模型空间原点作为面片锚点，提前在建模软件或脚本中，计算**每个顶点到自定义锚点的偏移量**，并将偏移数据存入**顶点颜色**。Shader 直接读取顶点颜色完成计算，彻底脱离对模型空间的依赖，间接改善合批问题。
```glsl
Shader "Unlit/Chapter11-Billboard-Optimized"
{
    Properties
    {
        _MainTex ("Texture", 2D) = "white" {}
        _Color ("Color Tint",Color) = (1,1,1,1)
        _VerticalBillboarding ("Vertical Resraints",Range(0,1)) = 1
    }
    SubShader
    {
        // 顶点动画必须关闭批处理
        Tags { "RenderType"="Transparent" "Queue"=Transparent "IgnoreProjector"="True" "DisableBatching"="True" }
        
        ZWrite Off
        Blend SrcAlpha OneMinusSrcAlpha
        Cull Off

        Pass
        {
            Tags {"LightMode" = "ForwardBase"}
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag

            #include "Lighting.cginc"

            sampler2D _MainTex;
            float4 _MainTex_ST;
            fixed4 _Color;
            float _VerticalBillboarding;

            struct a2v
            {
                float4 vertex : POSITION;
                float2 texcoord : TEXCOORD0;
                // 新增：接收顶点颜色（存储顶点到锚点的偏移）
                float4 color : COLOR;
            };

            struct v2f
            {
                float2 uv : TEXCOORD0;
                float4 pos : SV_POSITION;
            };

            v2f vert (a2v v)
            {
                v2f o;
                
                // ===================== 核心优化 =====================
                // 1. 从顶点颜色中直接读取 顶点到锚点的偏移量
                float3 centerOffs = v.color.rgb;
                
                // 2. 不再使用模型空间原点作为锚点！
                //    锚点 = 模型顶点 - 预存储的偏移量
                float3 center = v.vertex.xyz - centerOffs;
                // ====================================================
                
                // 模型空间相机位置
                float3 viewer = mul(unity_WorldToObject, float4(_WorldSpaceCameraPos, 1.0));
                float3 normalDir = viewer - center;

                normalDir.y = normalDir.y * _VerticalBillboarding;
                normalDir = normalize(normalDir);

                float3 upDir = abs(normalDir.y) > 0.999 ? float3(0,0,1) : float3(0,1,0);
                float3 rightDir = normalize(cross(upDir, normalDir));
                upDir = normalize(cross(normalDir, rightDir));

                // 计算广告牌新位置
                float3 localPos = center 
                                + centerOffs.x * rightDir 
                                + centerOffs.y * upDir 
                                + centerOffs.z * normalDir;
                
                o.pos = UnityObjectToClipPos(float4(localPos, 1));
                o.uv = TRANSFORM_TEX(v.texcoord, _MainTex);
                return o;
            }

            fixed4 frag (v2f i) : SV_Target
            {
                fixed4 color = tex2D(_MainTex, i.uv);
                color.rgb *= _Color.rgb;
                return color;
            }
            ENDCG
        }
    }
    Fallback "Transparent/VertexLit"
}
```
可以使用以下脚本把Quad顶点到锚点的距离存入顶点颜色：
```C#
using UnityEngine;

[RequireComponent(typeof(MeshFilter))]//脚本必须挂载在带有网格的物体上
public class BillboardVertexColor : MonoBehaviour
{
    void Start()
{
	//获取物体身上的网格组件
        Mesh mesh = GetComponent<MeshFilter>().mesh;
			//拿到网格里的所有顶点坐标
        Vector3[] vertices = mesh.vertices;
			//创建和顶点数一样大的颜色数组
        Color[] colors = new Color[vertices.Length];

        // 以模型中心为锚点，计算每个顶点到中心的偏移
        Vector3 center = Vector3.zero; 
        for (int i = 0; i < vertices.Length; i++)
        {
            Vector3 offset = vertices[i] - center;
            // 存储偏移到顶点颜色（xyz=偏移，w=1）
            colors[i] = new Color(offset.x, offset.y, offset.z, 1);
        }
			//把计算好的颜色数据写入网格
        mesh.colors = colors;
    }
}
```
---

### 为顶点动画物体添加阴影
#### 问题原因
1. 顶点动画在顶点着色器中修改了顶点位置，若使用引擎内置 `ShadowCaster` Pass，该 Pass 不会同步执行顶点偏移，最终出现**模型动、阴影不动**
![BQACAgUAAyEGAASHRsPbAAEVfQZqLrlyaQe85KgNrZ-OFqe9yKXTagACnCsAAhZseFWndU7sVGlPSDwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEVfQZqLrlyaQe85KgNrZ-OFqe9yKXTagACnCsAAhZseFWndU7sVGlPSDwE.png)
```glsl
Shader "Unlit/WaterShader"
{
    Properties
    {
        _MainTex ("Texture", 2D) = "white" {}
        _Color ("Color Tint",Color) = (1,1,1,1)
        _Frequency ("Frequency",Float) = 1
        _Magnitude ("Magnitude",Float) = 1
        _InvWaveLength ("Inverse Wave Length",Float) = 1
        _Speed ("Speed",Float) = 0.5
    }
    SubShader
    {
        Tags { "RenderType"="Transparent" "Queue" = "Transparent" "IgnoreProjector" = "True" "DisableBatching" = "True"}
        
        ZWrite Off
        Blend SrcAlpha OneMinusSrcAlpha
        Cull Off

        Pass
        {
            Tags {"LightMode" = "ForwardBase"}
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag

            #include "Lighting.cginc"

            sampler2D _MainTex;
            float4 _MainTex_ST;
            fixed4 _Color;
            Float _Frequency;
            Float _Magnitude;
            Float _InvWaveLength;
            Float _Speed;

            struct a2v
            {
                float4 vertex : POSITION;
                float2 texcoord : TEXCOORD0;
            };

            struct v2f
            {
                float2 uv : TEXCOORD0;
                float4 pos : SV_POSITION;
            };

            v2f vert (a2v v)
            {
                v2f o;
                float4 offset;
                offset.y=offset.z=offset.w=0.0f;
                offset.x = sin(_Frequency * _Time.y + v.vertex.x * _InvWaveLength + v.vertex.y * _InvWaveLength + v.vertex.z * _InvWaveLength)*_Magnitude;
                o.pos = UnityObjectToClipPos(v.vertex + offset);
                v.texcoord += float2(_Speed * _Time.y,0.0);
                o.uv = TRANSFORM_TEX(v.texcoord, _MainTex);
                return o;
            }

            fixed4 frag (v2f i) : SV_Target
            {
                fixed4 color = tex2D(_MainTex,i.uv);
                color.rgb*=_Color.rgb;
                return color;
            }
            ENDCG
        }
    }
    Fallback "VertexLit"
}
```
2. 若物体使用透明纹理，搭配透明度混合对应的 `Fallback "Transparent/VertexLit"`，引擎不会生成阴影。
![BQACAgUAAyEGAASHRsPbAAEVfQlqLrndcKmrs7Gn0_2-fkM-jXgAAacAAqErAAIWbHhVGIK-4tQkHj88BA.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEVfQlqLrndcKmrs7Gn0_2-fkM-jXgAAacAAqErAAIWbHhVGIK-4tQkHj88BA.png)
```glsl
Shader "Unlit/WaterShader"
{
    Properties
    {
        _MainTex ("Texture", 2D) = "white" {}
        _Color ("Color Tint",Color) = (1,1,1,1)
        _Frequency ("Frequency",Float) = 1
        _Magnitude ("Magnitude",Float) = 1
        _InvWaveLength ("Inverse Wave Length",Float) = 1
        _Speed ("Speed",Float) = 0.5
    }
    SubShader
    {
        Tags { "RenderType"="Transparent" "Queue" = "Transparent" "IgnoreProjector" = "True" "DisableBatching" = "True"}
        
        ZWrite Off
        Blend SrcAlpha OneMinusSrcAlpha
        Cull Off

        Pass
        {
            Tags {"LightMode" = "ForwardBase"}
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag

            #include "Lighting.cginc"

            sampler2D _MainTex;
            float4 _MainTex_ST;
            fixed4 _Color;
            Float _Frequency;
            Float _Magnitude;
            Float _InvWaveLength;
            Float _Speed;

            struct a2v
            {
                float4 vertex : POSITION;
                float2 texcoord : TEXCOORD0;
            };

            struct v2f
            {
                float2 uv : TEXCOORD0;
                float4 pos : SV_POSITION;
            };

            v2f vert (a2v v)
            {
                v2f o;
                float4 offset;
                offset.y=offset.z=offset.w=0.0f;
                offset.x = sin(_Frequency * _Time.y + v.vertex.x * _InvWaveLength + v.vertex.y * _InvWaveLength + v.vertex.z * _InvWaveLength)*_Magnitude;
                o.pos = UnityObjectToClipPos(v.vertex + offset);
                v.texcoord += float2(_Speed * _Time.y,0.0);
                o.uv = TRANSFORM_TEX(v.texcoord, _MainTex);
                return o;
            }

            fixed4 frag (v2f i) : SV_Target
            {
                fixed4 color = tex2D(_MainTex,i.uv);
                color.rgb*=_Color.rgb;
                return color;
            }
            ENDCG
        }
    }
    Fallback "Transparent/VertexLit"
}
```

#### 解决方案
参考**透明度剔除**的实现思路，**自定义 `ShadowCaster` Pass**，在该 Pass 中复刻与主体逻辑一致的顶点变换。
![BQACAgUAAyEGAASHRsPbAAEVfQ5qLroQcX_PetxjjyoLOiRr50cxxgACpisAAhZseFXWvv9wMPdUOzwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEVfQ5qLroQcX_PetxjjyoLOiRr50cxxgACpisAAhZseFXWvv9wMPdUOzwE.png)
```glsl
Shader "Unlit/WaterShader"
{
    Properties
    {
        _MainTex ("Texture", 2D) = "white" {}
        _Color ("Color Tint",Color) = (1,1,1,1)
        _Frequency ("Frequency",Float) = 1
        _Magnitude ("Magnitude",Float) = 1
        _InvWaveLength ("Inverse Wave Length",Float) = 1
        _Speed ("Speed",Float) = 0.5
    }
    SubShader
    {
        //Tags { "RenderType"="Transparent" "Queue" = "Transparent" "IgnoreProjector" = "True" "DisableBatching" = "True"}
        Tags {"RenderType" = "Opaque" "DisableBatching" = "True"}
        //ZWrite Off
        //Blend SrcAlpha OneMinusSrcAlpha
        //Cull Off

        Pass
        {
            Tags {"LightMode" = "ForwardBase"}
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag

            #include "Lighting.cginc"

            sampler2D _MainTex;
            float4 _MainTex_ST;
            fixed4 _Color;
            Float _Frequency;
            Float _Magnitude;
            Float _InvWaveLength;
            Float _Speed;

            struct a2v
            {
                float4 vertex : POSITION;
                float2 texcoord : TEXCOORD0;
            };

            struct v2f
            {
                float2 uv : TEXCOORD0;
                float4 pos : SV_POSITION;
            };

            v2f vert (a2v v)
            {
                v2f o;
                float4 offset;
                offset.y=offset.z=offset.w=0.0f;
                offset.x = sin(_Frequency * _Time.y + v.vertex.x * _InvWaveLength + v.vertex.y * _InvWaveLength + v.vertex.z * _InvWaveLength)*_Magnitude;
                o.pos = UnityObjectToClipPos(v.vertex + offset);
                v.texcoord += float2(_Speed * _Time.y,0.0);
                o.uv = TRANSFORM_TEX(v.texcoord, _MainTex);
                return o;
            }

            fixed4 frag (v2f i) : SV_Target
            {
                fixed4 color = tex2D(_MainTex,i.uv);
                color.rgb*=_Color.rgb;
                return color;
            }
            ENDCG
        }

        Pass{
            Tags {"LightMode" = "ShadowCaster"}
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile_shadowcaster

            #include "UnityCG.cginc"

            Float _Frequency;
            Float _Magnitude;
            Float _InvWaveLength;

            struct a2v
            {
                float4 vertex : POSITION;
                float2 texcoord : TEXCOORD0;
                float3 normal : NORMAL;
            };

            struct v2f
            {
                V2F_SHADOW_CASTER;
            };

            v2f vert (a2v v)
            {
                v2f o;
                float4 offset;
                offset.y=offset.z=offset.w=0.0f;
                offset.x = sin(_Frequency * _Time.y + v.vertex.x * _InvWaveLength + v.vertex.y * _InvWaveLength + v.vertex.z * _InvWaveLength)*_Magnitude;
                v.vertex += offset;
                TRANSFER_SHADOW_CASTER_NORMALOFFSET(o)
                return o;
            }

            fixed4 frag (v2f i) : SV_Target
            {
                SHADOW_CASTER_FRAGMENT(i)
            }
            ENDCG

        }
    }
    Fallback "VertexLit"
}
```
##### 自定义 ShadowCaster Pass 实现细节
1. 标记 Pass 的 `LightMode = ShadowCaster`，添加对应编译指令，并引入所需头文件。
2. 变量声明：复刻主体顶点动画所需的变换参数，无需声明纹理、UV 相关变量。
3. 顶点输入结构体：必须包含 `vertex`（顶点坐标）与 `normal`（法线）；也可直接使用引擎内置 `appdata_base`。
4. 输出结构体：使用 `V2F_SHADOW_CASTER` 宏，自动封装裁剪空间坐标等阴影相关数据，屏蔽不同平台、光源的格式差异。
5. 顶点着色器：执行和 `ForwardBase` 完全一致的顶点偏移逻辑，再将数据传入阴影内置宏。
6. 片元着色器：调用 `SHADOW_CASTER_FRAGMENT(i)`，该宏本质为 `return 0;`。阴影仅需写入深度，无需输出颜色，深度值由 GPU 自动插值计算。

##### 关键注意事项
`ShadowCaster` Pass 需要正常写入深度缓冲，因此所在 `SubShader` 必须满足以下条件：
- 标签设置：`RenderType = Opaque`、`Queue = Geometry`（也可省略）；
- 禁止添加透明相关配置：不能开启 `ZWrite Off`、`Blend` 混合指令，否则该 Pass 失效，无法生成阴影。

# 屏幕后处理
## 1. 基本执行流程
为摄像机挂载屏幕后处理脚本，实现 `OnRenderImage` 函数，该函数可获取已完成渲染的屏幕画面。
调用 `Graphics.Blit` 配合指定 Shader 执行后处理运算，将结果输出至目标纹理并最终显示到屏幕。
复杂特效需**多次调用 `Graphics.Blit`**，对上一阶段输出结果递进处理。

脚本基础编写步骤：
1. 创建对应 Shader 的材质；
2. 声明编辑器面板可调节参数；
3. 实现 `OnRenderImage` 方法，完成参数传递与 `Blit` 调用。

## 2. 后处理基类设计
正式编写后处理逻辑前，需先做运行环境校验：检测当前平台是否支持渲染纹理、屏幕特效以及目标 Shader。

基于以上需求封装**屏幕后处理基类**：
- 添加 `[ExecuteInEditMode]` 特性，支持**编辑模式**下实时预览效果，无需运行游戏。
- 工作逻辑：编辑器修改参数 → Unity 序列化/反序列化更新脚本变量 → 触发 `OnValidate()` → 标记视图重绘 → 引擎重新执行渲染流程并调用 `OnRenderImage`。
- 子类直接继承该基类，可复用上述能力，无需重复声明特性。
```C#
using System.Collections;
using System.Collections.Generic;
using UnityEngine;

[ExecuteInEditMode]//不运行游戏，面板滑块能调节，参数能赋值，材质能创建，但画面不会实时更新，因为OnRenderImage只能在PlayMode执行
[RequireComponent (typeof(Camera))]
public class PostEffectsBase : MonoBehaviour
{
    protected void CheckResources()
    {
        bool isSupported = CheckSupport();
        if(isSupported == false)
        {
            NotSupported();
        }
    }
    protected bool CheckSupport()
    {
        //if(SystemInfo.supportsImageEffects == false || SystemInfo.supportsRenderTextures == false)
        //{
        //    Debug.LogWarning("This platform does not support image effects or render textures.");
        //    return false;
        //}
        //系统默认支持屏幕特效和渲染纹理了，无需再判断
        return true;
    }
    protected void NotSupported()
    {
        enabled = false;
    }
    // Start is called before the first frame update
    protected void Start()
    {
        CheckResources();
    }
    protected Material CheckShaderAndCreateMaterial(Shader shader,Material material)
    {
        if(shader == null)//检查Shader可用性
        {
            return null;
        }
        if(shader.isSupported && material && material.shader == shader)//Shader可用，且传入了一个使用了该Shader的、不为空的材质，则直接返回
        {
            return material;
        }
        else
        {
            material = new Material(shader);//创建一个使用了该shader的新材质
            material.hideFlags = HideFlags.DontSave;//这个材质不会被保存到场景，也不会显示在 Hierarchy，关掉 Unity 就消失
            if (material)
            {
                return material;//创建成功，返回
            }
            else
            {
                return null;
            }
        }
    }

    // Update is called once per frame
    void Update()
    {
        
    }
}
```
## 3. 业务后处理脚本
新建脚本继承自屏幕后处理基类，并挂载到相机：
1. 引用目标 Shader，按需定义特效所需参数；
2. 在 `OnRenderImage` 中，将脚本参数传递至 Shader 对应变量；
3. 调用 `Graphics.Blit` 执行画面处理。

## 4. 后处理 Shader 编写
1. 图像处理 Pass 中，必须声明**后处理三要素标签**；
2. 在 CG 代码段内，声明与 C# 脚本一一对应的变量，保证参数正常传递；
3. 顶点着色器输入直接使用 Unity 内置 `appdata_image`，该结构体已包含顶点坐标与 UV 坐标，满足图像渲染需求。

---

### 问题解答
**Q：为何将后处理核心逻辑写在 Shader 中，而非直接在 `OnRenderImage` 里处理？**
A：屏幕后处理需要遍历全屏所有像素，计算量庞大。
- Shader 运行在 **GPU**，并行计算能力强，执行效率高；
- C# 脚本运行在 **CPU**，串行处理像素速度慢。

因此 `OnRenderImage` 仅负责**图像数据传递**，多阶段特效也依靠它完成帧缓存数据流转，不参与像素计算。

---

## 常见屏幕后处理效果实现
代码部分仅展示业务后处理脚本和后处理Shader，不再贴出后处理基类的代码（上面已经展示过），所有后处理效果的实现依赖的基类都是一样的。
### 1. 亮度、对比度、饱和度调整
通过 Shader 逐像素运算，依次对图像像素的亮度、对比度、饱和度数值进行线性修正。
![BQACAgUAAyEGAASHRsPbAAEVfSBqLrvuI7M9Gbun49lF7_8aY0LNVAACuSsAAhZseFWYsTFCmHnwCDwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEVfSBqLrvuI7M9Gbun49lF7_8aY0LNVAACuSsAAhZseFWYsTFCmHnwCDwE.png)
```C#
using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class BrightnessSaturationAndContrast : PostEffectsBase
{
    public Shader briSatConShader;//设成public，可在面板赋值
    private Material briSatConMaterial;//设成private，因为是内部创建、内部使用
    public Material material
    {
        get
        {
            briSatConMaterial = CheckShaderAndCreateMaterial(briSatConShader, briSatConMaterial);//调用基类的方法指定Shader的材质
            return briSatConMaterial;
        }
    }
    //声明一些可以在面板调整的参数
    [Range(0.0f, 3.0f)]
    public float brightness = 1.0f;

    [Range(0.0f, 3.0f)]
    public float saturation = 1.0f;

    [Range(0.0f, 3.0f)]
    public float contrast = 1.0f;

    void OnRenderImage(RenderTexture src,RenderTexture dest)
    {
        if(material != null)
        {
            //使用SetXXX声明可在Shader中使用的变量（C#中的变量，通过材质.SetXXX直接传给Shader里同名的变量，Shader就能拿到使用）
            material.SetFloat("_Brightness", brightness);
            material.SetFloat("_Saturation", saturation);
            material.SetFloat("_Contrast", contrast);

            Graphics.Blit(src, dest, material);//使用Graphics.Blit把当前屏幕图像存到src中，使用material身上的Shader进行处理，然后输出到dest中
        }
        else
        {
            Graphics.Blit(src, dest);//没有定义material，则对当前屏幕图像不做处理，原封不动的输出到dest中
        }
    }
    // Start is called before the first frame update
    void Start()
    {
        
    }

    // Update is called once per frame
    void Update()
    {
        
    }
}
```
```glsl
Shader "Unlit/Chapter12-BrightnessSaturationAndContrast"
{
    Properties
    {
        _MainTex ("Texture", 2D) = "white" {}
        _Brightness ("Brightness",Float) = 1
        _Saturation ("Saturation",Float) = 1
        _Contrast ("Contrast",Float) = 1
    }
    SubShader
    {

        Pass
        {
            ZTest Always//屏幕后处理要渲染的实际上是一个全屏四边形，这一行命令指明不论当前要渲染的像素的深度如何，都会显示在屏幕上
            Cull Off//取消背面剔除，正面背面都要画
            ZWrite Off//如果屏幕后处理在不透明物体渲染完后、透明物体渲染前执行，开启深度写入会导致透明度物体的渲染出现异常
            //上面三个命令是屏幕后处理 处理图像的标配（上面的命令写在Pass内而不是SubShader内Pass外，是因为后处理可能有其他Pass，这些Pass不一定需要上面的设置）
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag

            #include "UnityCG.cginc"

            sampler2D _MainTex;
            float4 _MainTex_ST;
            float _Brightness;
            float _Saturation;
            float _Contrast;
            //声明在CG代码段内可使用的变量。这里的变量声明不可省略。但Properties内的可以省略，因为Properties内的声明只是为了能够在面板调节，但是这些变量其实是屏幕后处理的脚本传递过来的

            struct v2f
            {
                float2 uv : TEXCOORD0;
                float4 pos : SV_POSITION;
            };

            v2f vert (appdata_img v)//使用Unity内置的appdata_img结构体直接作为顶点着色器的输入，内部包含uv和vertex等，用于图像处理。（后处理只需要vertex和uv，可以直接使用）
            {
                v2f o;
                o.pos = UnityObjectToClipPos(v.vertex);
                o.uv = TRANSFORM_TEX(v.texcoord, _MainTex);
                return o;
            }

            fixed4 frag (v2f i) : SV_Target//调整亮度、饱和度和对比度的逻辑都在片元着色器中实现
            {
                fixed4 renderTex = tex2D(_MainTex,i.uv);

                fixed3 finalColor = renderTex.rgb*_Brightness;

                //饱和度需要在黑白和原色之间插值
                fixed luminance = 0.2125 * renderTex.r + 0.7154 * renderTex.g + 0.0721 * renderTex.b;//计算灰度值（饱和度为0的原图像）
                fixed3 luminanceColor = fixed3 (luminance,luminance,luminance);//扩展为三分量以便插值，由于是逐分量插值，所以三分量都写一样的灰度值即可
                finalColor = lerp(luminanceColor,finalColor,_Saturation);//finalColor是上一步（亮度）处理之后的图像，也是未经饱和度处理时的最初图像，作为插值的终点

                //对比度需要在灰色和原色之间插值
                fixed3 avgColor = fixed3(0.5,0.5,0.5);//对比度为0的颜色值
                finalColor = lerp(avgColor,finalColor,_Contrast);

                return fixed4(finalColor,renderTex.a);//使用纹理颜色的透明度通道作为返回颜色的透明度通道而不使用1：因为是对屏幕图像进行亮度、对比度和饱和度的后处理，没有透明度处理，所以不能改变了图像原来的透明度
            }
            ENDCG
        }
    }
}
```
### 2. 边缘检测
#### 原理
使用边缘检测算子对像素做**卷积运算**，计算像素水平、竖直方向梯度；梯度值越大，判定为边缘的概率越高。
![BQACAgUAAyEGAASHRsPbAAEVfSRqLrw4hX8a0CViaR5bC-iC7HXadwACvSsAAhZseFWIDq3lPrsPhDwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEVfSRqLrw4hX8a0CViaR5bC-iC7HXadwACvSsAAhZseFWIDq3lPrsPhDwE.png)
#### 实现流程
1. **相机侧脚本**
   继承屏幕后处理基类，定义 Shader、材质与编辑器可调参数；在 `OnRenderImage` 中将参数传入 Shader，并调用 `Graphics.Blit`。
```C#
using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class EdgeDetection : PostEffectsBase
{
    public Shader edgeDetectShader;
    private Material edgeDetectMaterial;
    public Material material//每次写material这个变量时，都会执行一遍下边的get函数，检查Shader并返回可用的、指定Shader的材质
    {
        get
        {
            edgeDetectMaterial = CheckShaderAndCreateMaterial(edgeDetectShader, edgeDetectMaterial);
            return edgeDetectMaterial;
        }
    }

    [Range(0.0f, 1.0f)]
    public float edgesOnly = 0.0f;//控制背景和原图的显示强度
    public Color edgeColor = Color.black;
    public Color backgroundColor = Color.white;//代码实现的是在原图上叠加边缘或者是在纯色背景上叠加边缘

    public void OnRenderImage(RenderTexture src,RenderTexture dest)
    {
        if(material != null)
        {
            material.SetFloat("_EdgesOnly", edgesOnly);
            material.SetColor("_EdgeColor", edgeColor);
            material.SetColor("_BackgroundColor", backgroundColor);
            Graphics.Blit(src,dest,material);
        }
        else
        {
            Graphics.Blit(src, dest);
        }
    }
    // Start is called before the first frame update
    void Start()
    {
        
    }

    // Update is called once per frame
    void Update()
    {
        
    }
}
```
2. **Shader 逻辑**
   - 顶点着色器：采样当前像素 UV，并计算周围 8 个相邻纹素的 UV，统一存入数组；
   - 片元着色器：对当前像素所在 **3×3 区域**分别使用水平、垂直卷积核做卷积；先通过像素颜色计算灰度值，再结合卷积核权重求得水平梯度、垂直梯度，叠加得到总梯度（边缘系数）；
   - 颜色混合：利用边缘系数分别插值「纯色背景+边缘色」「原图+边缘色」两套画面，再通过 `_EdgesOnly` 参数插值混合，输出最终效果。
```glsl
Shader "Unlit/Chapter12-EdgeDetection"
{
    Properties
    {
        _MainTex ("Texture", 2D) = "white" {}
        _EdgesOnly ("Edges Only",Float) = 1
        _EdgeColor ("Edge Color",Color) = (0,0,0,1)
        _BackgroundColor ("Background Color",Color) = (1,1,1,1)
    }
    SubShader
    {

        Pass
        {
            ZTest Always
            Cull Off
            ZWrite Off
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag

            #include "UnityCG.cginc"

            sampler2D _MainTex;
            half4 _MainTex_TexelSize;//这是Unity的内置变量，固定为half4类型，（1/宽度，1/高度，宽度，高度）
            fixed _EdgesOnly;
            fixed4 _EdgeColor;
            fixed4 _BackgroundColor;

            struct v2f
            {
                half2 uv[9] : TEXCOORD0;
                float4 vertex : SV_POSITION;
            };

            v2f vert (appdata_img v)
            {
                v2f o;
                o.vertex = UnityObjectToClipPos(v.vertex);
                half2 uv = v.texcoord;//后处理处理的是和屏幕大小相同的面片，全屏面片uv和屏幕面片uv一一对应，所以不需要TRANSFORM_TEX
                o.uv[0] = uv + _MainTex_TexelSize.xy * float2(-1,-1);
                o.uv[1] = uv + _MainTex_TexelSize.xy * float2(-1,0);
                o.uv[2] = uv + _MainTex_TexelSize.xy * float2(-1,1);
                o.uv[3] = uv + _MainTex_TexelSize.xy * float2(0,1);
                o.uv[4] = uv + _MainTex_TexelSize.xy * float2(0,0);
                o.uv[5] = uv + _MainTex_TexelSize.xy * float2(0,-1);
                o.uv[6] = uv + _MainTex_TexelSize.xy * float2(1,1);
                o.uv[7] = uv + _MainTex_TexelSize.xy * float2(1,0);
                o.uv[8] = uv + _MainTex_TexelSize.xy * float2(1,-1);
                return o;
            }

            fixed4 luminance(fixed4 color){
                return 0.2125 * color.r + 0.7154 * color.g + 0.0721 * color.b;
            }

            half Sobel(v2f i){
                const half Gx[9]={-1,-2,-1,
                                0,0,0,
                                1,2,1};
                const half Gy[9]={-1,0,1,
                                -2,0,2,
                                -1,0,1};
                half texColor;
                half edgeX=0;
                half edgeY=0;
                for(int it=0;it<9;it++){
                    texColor = luminance(tex2D(_MainTex,i.uv[it]));
                    edgeX += Gx[it]*texColor;
                    edgeY += Gy[it]*texColor;
                }
                half edge = abs(edgeX)+abs(edgeY);
                return edge;//edge的范围是[-8,8]，在插值的时候，<0的部分截断为0，大于0的部分截断为1，且小于0和大于0的部分概率一样
            }

            fixed4 frag (v2f i) : SV_Target
            {
                half edge = Sobel(i);
                fixed4 withEdgeColor = lerp(tex2D(_MainTex,i.uv[4]),_EdgeColor,edge);//原图上描边
                fixed4 edgeOnlyColor = lerp(_BackgroundColor,_EdgeColor,edge);//纯色背景上描边
                return lerp(withEdgeColor,edgeOnlyColor,_EdgesOnly);//以_EdgeOnly在原图描边和纯色背景描边之间插值
            }
            ENDCG
        }
    }
    Fallback Off//纯后处理Shader不需要投射阴影，也不需要替代Pass，FallBack会带来多余Pass
}
```
### 3. 高斯模糊
#### 原理
采用**分离高斯核**优化，拆分为**竖直卷积**、**水平卷积**两个 Pass 分步对图像做卷积。
> 说明：高斯模糊是对**像素颜色值**加权卷积，区别于边缘检测（基于灰度值计算）。
![BQACAgUAAyEGAASHRsPbAAEVfSpqLryLcx98dgmSA8uE8okyXF4sWAACwysAAhZseFVCqGDfXnXmpDwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEVfSpqLryLcx98dgmSA8uE8okyXF4sWAACwysAAhZseFVCqGDfXnXmpDwE.png)
```C#
using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class GaussianBlur : PostEffectsBase
{
    public Shader GaussianBlurShader;
    private Material GaussianBlurMaterial;
    public Material material
    {
        get
        {
            GaussianBlurMaterial = CheckShaderAndCreateMaterial(GaussianBlurShader,GaussianBlurMaterial);
            return GaussianBlurMaterial;
        }
    }

    [Range(0, 4)]
    public int iterations = 3;
    [Range(0.2f, 3.0f)]
    public float blurSize = 0.6f;
    [Range(1, 8)]
    public int downSamples = 2;

    public void OnRenderImage(RenderTexture src,RenderTexture dest)
    {
        if(material != null)
        {
            int rtw = src.width / downSamples;
            int rth = src.height / downSamples;
            RenderTexture buffer0 = RenderTexture.GetTemporary(rtw, rth, 0);//这里的第三个参数指的是深度缓冲区位数，填0表示不需要存深度信息（屏幕后处理只是处理最终画面，不渲染新物体，不判断遮挡，因此不需要深度信息）。其他非零数表示需要用多少位存储深度信息如16/24
            Graphics.Blit(src, buffer0);//把降采样之后的图像存入buffer0，作为高斯模糊的起始图像

            for(int i = 0; i < iterations; i++)//每次迭代都是处理两次高斯模糊，每次高斯模糊的原图都是buffer0，最终图像都是buffer1。所以在处理了一次之后需要交换
            {
                material.SetFloat("_BlurSize", 1.0f + i * blurSize);
                RenderTexture buffer1 = RenderTexture.GetTemporary(rtw, rth, 0);//每次处理都需要一张干净的空图作为目标图像
                Graphics.Blit(buffer0, buffer1, material, 0);
                RenderTexture.ReleaseTemporary(buffer0);//使用完的旧图及时销毁
                buffer0 = buffer1;//把上一次处理的结果放回buffer0

                buffer1 = RenderTexture.GetTemporary(rtw, rth, 0);//每次处理都需要一张干净的空图作为目标图像
                Graphics.Blit(buffer0, buffer1, material, 1);
                RenderTexture.ReleaseTemporary(buffer0);//使用完的旧图及时销毁
                buffer0 = buffer1;
            }

            Graphics.Blit(buffer0, dest);
            RenderTexture.ReleaseTemporary(buffer0);
        }
        else
        {
            Graphics.Blit(src, dest);
        }
    }
    // Start is called before the first frame update
    void Start()
    {
        
    }

    // Update is called once per frame
    void Update()
    {
        
    }
}
```
```glsl
Shader "Unlit/Chapter12-GaussianBlur"
{
    Properties
    {
        _MainTex ("Texture", 2D) = "white" {}
        _BlurSize ("Blur Size",Float) = 0.6
    }
    SubShader
    {
        CGINCLUDE
            sampler2D _MainTex;
            float4 _MainTex_TexelSize;
            float _BlurSize;

            #include "UnityCG.cginc"

            struct v2f{
                float4 pos : SV_POSITION;
                half2 uv[5] : TEXCOORD0;
            };

            v2f vertBlurVertical(appdata_img v){
                v2f o;
                o.pos = UnityObjectToClipPos(v.vertex);
                half2 uv = v.texcoord;
                o.uv[0] = uv + _MainTex_TexelSize * float2(0,0);
                o.uv[1] = uv + _MainTex_TexelSize * float2(0,1);
                o.uv[2] = uv + _MainTex_TexelSize * float2(0,2);
                o.uv[3] = uv + _MainTex_TexelSize * float2(0,-1);
                o.uv[4] = uv + _MainTex_TexelSize * float2(0,-2);

                return o;
            }

            v2f vertBlurHorizonal(appdata_img v){
                v2f o;
                o.pos = UnityObjectToClipPos(v.vertex);
                half2 uv = v.texcoord;
                o.uv[0] = uv + _MainTex_TexelSize * float2(0,0);
                o.uv[1] = uv + _MainTex_TexelSize * float2(1,0);
                o.uv[2] = uv + _MainTex_TexelSize * float2(2,0);
                o.uv[3] = uv + _MainTex_TexelSize * float2(-1,0);
                o.uv[4] = uv + _MainTex_TexelSize * float2(-2,0);

                return o;
            }

            fixed4 frag(v2f i) : SV_Target{
                float weights[3] = {0.4026,0.2442,0.0545};
                fixed3 sum = tex2D(_MainTex,i.uv[0]).rgb * weights[0];

                for(int it=1;it<3;it++){
                    sum += tex2D(_MainTex,i.uv[it]).rgb * weights[it];
                    sum += tex2D(_MainTex,i.uv[it+2]).rgb * weights[it];
                }
                
                return fixed4(sum,1.0);//透明度直接写1：屏幕后处理处理的是屏幕，且屏幕不是透明物体。只需处理颜色，不需要改变透明度。
            }
        ENDCG

        ZTest Always
        Cull Off
        ZWrite Off

        Pass
        {
            NAME "GAUSSIAN_BLUR_VERTICAL"
            CGPROGRAM
            #pragma vertex vertBlurVertical
            #pragma fragment frag
            ENDCG
        }

        Pass
        {
            NAME "GAUSSIAN_BLUR_HORIZONAL"
            CGPROGRAM
            #pragma vertex vertBlurHorizonal
            #pragma fragment frag
            ENDCG
        }
    }
    Fallback Off
}
```
### 4. Bloom
#### 原理
1. 通过亮度阈值筛选出画面高亮区域，单独存入一张渲染纹理；
2. 对高亮纹理执行高斯模糊；
3. 将模糊后的高亮图层与原始画面叠加混合，形成辉光效果。
![BQACAgUAAyEGAASHRsPbAAEVfS5qLr0C0qYRrKEuO7UWKsrmq9g_vgACxysAAhZseFVvXvsBc5sm3TwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEVfS5qLr0C0qYRrKEuO7UWKsrmq9g_vgACxysAAhZseFVvXvsBc5sm3TwE.png)
```C#
using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class Bloom : PostEffectsBase
{
    public Shader BloomShader;
    private Material BloomMaterial;
    public Material material
    {
        get
        {
            BloomMaterial = CheckShaderAndCreateMaterial(BloomShader, BloomMaterial);
            return BloomMaterial;
        }
    }

    [Range(0, 4)]
    public int iterations = 3;

    [Range(0.2f, 3.0f)]
    public float blurSize = 0.6f;

    [Range(1, 8)]
    public int downSamples = 2;

    [Range(0.0f, 4.0f)]
    public float luminanceThreshold = 0.6f;

    public void OnRenderImage(RenderTexture src,RenderTexture dest)
    {
        if(material != null)
        {
            material.SetFloat("_LuminanceThreshold", luminanceThreshold);
            int rtw = src.width / downSamples;
            int rth = src.height / downSamples;

            RenderTexture buffer0 = RenderTexture.GetTemporary(rtw, rth, 0);

            Graphics.Blit(src, buffer0, material, 0);//先调用Pass 0完成亮部提取，然后存放到buffer0（下采样）

            for(int i = 0; i < iterations; i++)
            {
                material.SetFloat("_BlurSize", 1.0f + i * blurSize);

                RenderTexture buffer1 = RenderTexture.GetTemporary(rtw, rth, 0);

                Graphics.Blit(buffer0, buffer1, material, 1);

                RenderTexture.ReleaseTemporary(buffer0);
                buffer0 = buffer1;

                buffer1 = RenderTexture.GetTemporary(rtw, rth, 0);
                Graphics.Blit(buffer0, buffer1, material, 2);
                RenderTexture.ReleaseTemporary(buffer0);
                buffer0 = buffer1;
            }
            material.SetTexture("_Bloom", buffer0);//把做完高斯模糊的图像传给Shader中的_Bloom纹理做融合
            Graphics.Blit(src, dest, material, 3);//src传入Shader的_MainTex纹理，_MainTex纹理和_Bloom纹理融合后的结果存入dest
        }
        else
        {
            Graphics.Blit(src, dest);
        }
    }
    // Start is called before the first frame update
    void Start()
    {
        
    }

    // Update is called once per frame
    void Update()
    {
        
    }
}
```
```glsl
Shader "Unlit/Chapter12-GaussianBlur"
{
    Properties
    {
        _MainTex ("Texture", 2D) = "white" {}
        _BlurSize ("Blur Size",Float) = 0.6
    }
    SubShader
    {
        CGINCLUDE
            sampler2D _MainTex;
            float4 _MainTex_TexelSize;
            float _BlurSize;

            #include "UnityCG.cginc"

            struct v2f{
                float4 pos : SV_POSITION;
                half2 uv[5] : TEXCOORD0;
            };

            v2f vertBlurVertical(appdata_img v){
                v2f o;
                o.pos = UnityObjectToClipPos(v.vertex);
                half2 uv = v.texcoord;
                o.uv[0] = uv + _MainTex_TexelSize.xy * float2(0,0) * _BlurSize;//_MainTex_TexelSize是half4类型的，需要提取xy分量进行运算
                o.uv[1] = uv + _MainTex_TexelSize.xy * float2(0,1) * _BlurSize;//记得乘以_BlurSize控制模糊程度
                o.uv[2] = uv + _MainTex_TexelSize.xy * float2(0,2) * _BlurSize;
                o.uv[3] = uv + _MainTex_TexelSize.xy * float2(0,-1) * _BlurSize;
                o.uv[4] = uv + _MainTex_TexelSize.xy * float2(0,-2) * _BlurSize;

                return o;
            }

            v2f vertBlurHorizonal(appdata_img v){
                v2f o;
                o.pos = UnityObjectToClipPos(v.vertex);
                half2 uv = v.texcoord;
                o.uv[0] = uv + _MainTex_TexelSize.xy * float2(0,0) * _BlurSize;
                o.uv[1] = uv + _MainTex_TexelSize.xy * float2(1,0) * _BlurSize;
                o.uv[2] = uv + _MainTex_TexelSize.xy * float2(2,0) * _BlurSize;
                o.uv[3] = uv + _MainTex_TexelSize.xy * float2(-1,0) * _BlurSize;
                o.uv[4] = uv + _MainTex_TexelSize.xy * float2(-2,0) * _BlurSize;

                return o;
            }

            fixed4 frag(v2f i) : SV_Target{
                float weights[3] = {0.4026,0.2442,0.0545};
                fixed3 sum = tex2D(_MainTex,i.uv[0]).rgb * weights[0];

                for(int it=1;it<3;it++){
                    sum += tex2D(_MainTex,i.uv[it]).rgb * weights[it];
                    sum += tex2D(_MainTex,i.uv[it+2]).rgb * weights[it];
                }
                
                return fixed4(sum,1.0);//透明度直接写1：屏幕后处理处理的是屏幕，且屏幕不是透明物体。只需处理颜色，不需要改变透明度。
            }
        ENDCG

        ZTest Always
        Cull Off
        ZWrite Off

        Pass
        {
            NAME "GAUSSIAN_BLUR_VERTICAL"
            CGPROGRAM
            #pragma vertex vertBlurVertical
            #pragma fragment frag
            ENDCG
        }

        Pass
        {
            NAME "GAUSSIAN_BLUR_HORIZONTAL"
            CGPROGRAM
            #pragma vertex vertBlurHorizonal
            #pragma fragment frag
            ENDCG
        }
    }
    Fallback Off
}
```
```glsl
Shader "Unlit/Chapter12-Bloom"
{
    Properties
    {
        _MainTex ("Texture", 2D) = "white" {}
        _Bloom ("Bloom Texture",2D) = "white"{}
        _BlurSize ("Blur Size",Float) = 0.6
        _LuminanceThreshold ("Luminance Threshold",Float) = 0.6
    }
    SubShader
    {
        CGINCLUDE
            sampler2D _MainTex;
            half4 _MainTex_TexelSize;
            sampler2D _Bloom;
            float _BlurSize;
            float _LuminanceThreshold;

            #include "UnityCG.cginc"

            struct v2fExtractBright{
                float4 pos : SV_POSITION;
                half2 uv : TEXCOORD0;
            };

            v2fExtractBright vertExtractBright(appdata_img v){
                v2fExtractBright o;
                o.pos = UnityObjectToClipPos(v.vertex);
                o.uv = v.texcoord;
                return o;
            };

            fixed luminace(fixed4 color){
                return 0.2125 * color.r + 0.7154 * color.g + 0.0721 * color.b;
            }

            fixed4 fragExtractBright(v2fExtractBright i) : SV_Target{
                fixed4 texColor = tex2D(_MainTex,i.uv);
                fixed val = clamp(luminace(texColor) - _LuminanceThreshold,0.0,1.0);
                return texColor * val;
            }

            struct v2fBloom{
                float4 pos : SV_POSITION;
                half4 uv : TEXCOORD0;
            };

            v2fBloom vertBloom(appdata_img v){
                v2fBloom o;//记得声明的结构体需要和返回结构体类型一致

                o.pos = UnityObjectToClipPos(v.vertex);

                o.uv.xy = v.texcoord;
                o.uv.zw = v.texcoord;

                #if UNITY_UV_STARTS_AT_TOP
                if(_MainTex_TexelSize.y < 0.0){//_MainTex是当前屏幕RT，代表当前平台的UV规则，由unity自动处理(如果当前平台的UV规则和_MainTex中的UV规则不一致，则unity会帮忙翻转并在y分量标记)。但_Bloom是自己定义并传入shader的，unity不会自动处理它的UV，所以需要根据当前平台的UV规则修正
                    o.uv.w = 1.0 - o.uv.w;
                }
                #endif//不要忘记写

                return o;
            }

            fixed4 fragBloom(v2fBloom i) : SV_Target{
                fixed4 texColor = tex2D(_MainTex,i.uv.xy);
                fixed4 bloomColor = tex2D(_Bloom,i.uv.zw);
                return texColor + bloomColor;//是叠加而非lerp：Bloom的物理意义是向外溢光，是额外能量，属于加性光源
            }
        ENDCG

        ZTest Off
        Cull Off
        ZWrite Off

        Pass
        {
            CGPROGRAM
            #pragma vertex vertExtractBright
            #pragma fragment fragExtractBright
            ENDCG
        }

        UsePass "Unlit/Chapter12-GaussianBlur/GAUSSIAN_BLUR_VERTICAL"

        UsePass "Unlit/Chapter12-GaussianBlur/GAUSSIAN_BLUR_HORIZONTAL"

        Pass{
            CGPROGRAM
            #pragma vertex vertBloom
            #pragma fragment fragBloom
            ENDCG
        }
    }
    Fallback Off
}
```
#### 实现总结
1. 高斯模糊仅作用于提取出的亮部区域，若亮部范围小、亮度弱，调整模糊参数画面无明显变化；
2. 常规画面为 LDR 低动态范围，像素亮度上限低，因此**亮度阈值(Luminance Threshold)接近 0** 时，Bloom 效果才会显著。

### 5. 运动模糊
#### 原理
创建一张**累计纹理**：
1. 当前帧画面存入累计纹理；
2. 下一帧将新画面与累计纹理做颜色融合，结果重新存入累计纹理；
3. 多帧叠加后形成拖影，模拟运动模糊效果。
![BQACAgUAAyEGAASHRsPbAAEVfTRqLr1frvpJt6jowXo9DQ4iEsXTsQACzSsAAhZseFVuZTOkTNgG-zwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEVfTRqLr1frvpJt6jowXo9DQ4iEsXTsQACzSsAAhZseFVuZTOkTNgG-zwE.png)
```C#
using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class MotionBlur : PostEffectsBase
{
    public Shader MotionBlurShader;
    private Material MotionBlurMaterial;
    public Material material
    {
        get
        {
            MotionBlurMaterial = CheckShaderAndCreateMaterial(MotionBlurShader, MotionBlurMaterial);
            return MotionBlurMaterial;
        }
    }

    [Range(0.0f, 0.9f)]
    public float blurAmount = 0.5f;

    private RenderTexture accumulationTexture;

    void OnDisable()//脚本被关闭、游戏退出、场景切换时被调用，消除accumulationTexture中残留的上一次运行时的画面，保证下次启动时这张累计纹理是干净的
    {
        DestroyImmediate(accumulationTexture);
    }

    public void OnRenderImage(RenderTexture src,RenderTexture dest)
    {
        if(material != null)
        {
            if(accumulationTexture == null || accumulationTexture.width != src.width || accumulationTexture.height != src.height)
            {
                DestroyImmediate(accumulationTexture);
                accumulationTexture = new RenderTexture(src.width, src.height, 0);
                accumulationTexture.hideFlags = HideFlags.HideAndDontSave;//不在Hieracy面板中显示，也不保存到场景中
                Graphics.Blit(src, accumulationTexture);//创建了累计纹理之后，就用当前帧的画面初始化，否则累计纹理纯黑，之后混合时会使结果图像偏暗
            }

            //accumulationTexture.MarkRestoreExpected();//新版的unity已经废除了这个写法

            material.SetFloat("_BlurAmount", 1-blurAmount);//使用1-赋值而非原数赋值，是想更多的保留原图的画面
            Graphics.Blit(src, accumulationTexture, material);//进行混合的操作
            Graphics.Blit(accumulationTexture, dest);//把混合后的纹理输出到屏幕
        }
        else
        {
            Graphics.Blit(src, dest);
        }
    }
    // Start is called before the first frame update
    void Start()
    {
        
    }

    // Update is called once per frame
    void Update()
    {
        
    }
}
```
```glsl
Shader "Unlit/Chapter12-MotionBlur"
{
    Properties
    {
        _MainTex ("Texture", 2D) = "white" {}
        _BlurAmount ("Blur Amount",Float) = 1.0
    }
    SubShader
    {
        CGINCLUDE
            sampler2D _MainTex;
            float _BlurAmount;

            #include "UnityCG.cginc"
            struct v2f{
                float4 pos : SV_POSITION;
                float2 uv : TEXCOORD0;
            };

            v2f vert(appdata_img v){
                v2f o;
                o.pos = UnityObjectToClipPos(v.vertex);
                o.uv = v.texcoord;
                return o;
            }

            fixed4 fragRGB(v2f i) : SV_Target{
                return fixed4(tex2D(_MainTex,i.uv).rgb,_BlurAmount);//为什么把_BlurAmount作为透明度通道：待会混合的时候，使用Blend SrcAlpha OneMinusSrcAlpha
                //不写lerp而是采用blend的原因：实际上lerp与blend在这里等价。但是lerp是Shader ALU计算，blend是GPU固定功能硬件混合，后者成本更低
            }
            fixed4 fragA(v2f i) : SV_Target{
                return tex2D(_MainTex,i.uv);
            }
        ENDCG

        ZTest Always
        ZWrite Off
        Cull Off

        Pass//第一个Pass使用_BlurAmount混合新图和旧图的颜色
        {
            Blend SrcAlpha OneMinusSrcAlpha//最终颜色=新图颜色*alpha + 旧图颜色*(1-alpha)，想要旧图颜色更多，则alpha=1-blurAmount而不是alpha=blurAmount
            ColorMask RGB//写了Blend命令后，GPU将自动读取目标纹理中的颜色，按照指定的规则进行混合
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment fragRGB
            ENDCG
        }

        Pass//由于混合时不希望透明度也混合，所以拆分成了两个Pass，这一个Pass算记录下原图的透明度，然后将透明度直接写入新图
        {
            Blend One Zero
            ColorMask A
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment fragA
            ENDCG
        }
    }
    Fallback Off
}
```

# 深度纹理和法线纹理
## 1. 深度纹理
深度纹理存储**NDC 空间非线性深度**：将 NDC 坐标的 $z$ 值（范围 $[-1,1]$）线性映射为 $[0,1]$ 区间。

- **前向渲染**：借助**着色器替换**，筛选 `RenderType=Opaque`、`Queue<=2500` 的物体，使用替换着色器的 `ShadowCaster` Pass 重新渲染生成深度纹理。
  若替换着色器无 `ShadowCaster` Pass，对应物体不会写入深度纹理，无法被其他物体采样深度，也就**不能投射阴影**。
- **延迟渲染**：可直接从 G-Buffer 中获取深度数据。
- 精度：常见为 16 位 / 24 位；数值越小代表离相机越近，纹理对应区域越偏黑色。

## 2. 深度+法线纹理
该纹理同时存储**观察空间法线**与**线性深度**，整体为 32 位、尺寸等同屏幕的纹理：
- **RG 通道**：存储观察空间法线的 $xy$ 分量；法线为归一化向量，$z$ 分量可由 $xy$ 推导得出。
- **BA 通道**：存储**观察空间线性深度**（范围 $[0,1]$），代表物体到相机的实际距离，深度数据至少需要 16 位精度。

- **延迟渲染**：法线信息可直接从 G-Buffer 获取；
- **前向渲染**：默认不生成法线缓冲，需要额外单独 Pass 渲染。

## 3. 纹理启用与引用
通过设置摄像机的 `depthTextureMode` 开启对应纹理：
```csharp
// 仅获取深度纹理
camera.depthTextureMode = DepthTextureMode.Depth;
// 获取深度+法线纹理
camera.depthTextureMode = DepthTextureMode.DepthNormals;
```

在 Shader 中声明内置纹理变量即可使用：
- 深度纹理：`_CameraDepthTexture`
- 深度+法线纹理：`_CameraDepthNormalsTexture`

采样时配合 Unity 内置宏，自动适配不同平台差异。

## 4. 深度纹理采样方式
### `SAMPLE_DEPTH_TEXTURE`
接收**已完成透视除法**、范围 $[0,1]$ 的二维屏幕 UV（`float2`）。

### `SAMPLE_DEPTH_TEXTURE_PROJ`
接收**未做透视除法**的齐次坐标（`float3`/`float4`，包含 $w$ 分量），常用于阴影计算。
通常搭配 `UNITY_PROJ_COORD` 宏做平台兼容：
- D3D11、D3D12、Metal 等平台：内部自动执行透视除法，可直接传入 `ComputeScreenPos` 得到的坐标；
- OpenGL、OpenGL ES 及部分移动端平台：不会自动透视除法，`UNITY_PROJ_COORD` 会提前完成透视除法。

## 5. 深度+法线纹理采样
直接使用 `tex2D` 采样，返回 `float4` 类型数据：
- `xy`：观察空间法线
- `zw`：线性深度信息

## 6. 采样结果解码处理
### 深度纹理解码
深度纹理存储的是非线性深度，计算时需要转为**线性深度**：
1. 由 NDC 深度反向推导得到观察空间原始 $z_{view}$（负值），取反后得到相机到物体的真实深度 $z_{view}'$（范围 $[Near, Far]$）；
2. 再次映射可得到 $[0,1]$ 区间线性深度。

Unity 提供内置函数简化转换：
- `LinearEyeDepth`：输出观察空间真实深度 $z_{view}'$
- `Linear01Depth`：输出 $[0,1]$ 区间线性深度

### 深度+法线纹理解码
使用内置宏 `DecodeDepthNormal` 一次性解码：
- 内部调用 `DecodeFloatRG` 解析深度
- 内部调用 `DecodeViewNormalStereo` 解析观察空间法线

## 7. 深度纹理应用：运动模糊
区别于前后帧画面直接混合的实现方案，本方案借助**深度纹理构建速度映射图**，依据像素运动速度控制模糊的大小与方向。

### 速度映射图构建流程
1. 采样深度纹理，取出屏幕空间非线性深度，重映射还原为 NDC 空间 $z$ 值（$[-1,1]$）；
2. 结合像素 UV 换算出 NDC 空间 $x、y$ 坐标，NDC 下 $w=1$，得到完整 NDC 坐标；
3. 依次执行**逆投影变换**、**逆视图变换**，还原得到像素对应的世界坐标；
4. 将该世界坐标代入**上一帧 VP 矩阵**，再做透视除法，得到上一帧对应的 NDC 坐标；
5. 对比当前帧与上一帧 NDC 坐标，计算像素二维偏移量，最终得到运动速度。

> 选用 NDC 坐标原因：屏幕后处理属于二维屏幕空间运算，NDC 坐标与屏幕空间近似等价，适合计算像素偏移。

```C#
using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class MotionBlurWithDepthTexture : PostEffectsBase
{
    public Shader motionBlurShader;
    private Material motionBlurMaterial;
    public Material material
    {
        get
        {
            motionBlurMaterial = CheckShaderAndCreateMaterial(motionBlurShader, motionBlurMaterial);
            return motionBlurMaterial;
        }
    }

    [Range(0.0f, 1.0f)]
    public float blurSize = 0.5f;

    private Camera myCamera;
    public Camera camera
    {
        get
        {
            if(myCamera == null)
            {
                myCamera = GetComponent<Camera>();
            }
            return myCamera;
        }
    }

    private Matrix4x4 previousViewProjectionMatrix;

    void OnEnable()
    {
        camera.depthTextureMode |= DepthTextureMode.Depth;
    }

    void OnRenderImage(RenderTexture src,RenderTexture dest)
    {
        if(material != null)
        {
            material.SetFloat("_BlurSize", blurSize);
            material.SetMatrix("_PreviousViewProjectionMatrix", previousViewProjectionMatrix);
            Matrix4x4 currentViewProjectionMatrix = camera.projectionMatrix * camera.worldToCameraMatrix;
            Matrix4x4 currentViewProjectionInverseMatrix = currentViewProjectionMatrix.inverse;
            material.SetMatrix("_CurrentViewProjectionInverseMatrix", currentViewProjectionInverseMatrix);
            previousViewProjectionMatrix = currentViewProjectionMatrix;

            Graphics.Blit(src, dest, material);
        }
        else
        {
            Graphics.Blit(src, dest);
        }
    }
    // Start is called before the first frame update
    void Start()
    {
        
    }

    // Update is called once per frame
    void Update()
    {
        
    }
}
```
```glsl
Shader "Unlit/Chapter13-MotionBlurWithDepthTexture"
{
    Properties
    {
        _MainTex ("Texture", 2D) = "white" {}
        _BlurSize ("Blur Size",Float) = 1.0
    }
    SubShader
    {
        CGINCLUDE
        sampler2D _MainTex;
        half4 _MainTex_TexelSize;
        sampler2D _cameraDepthTexture;//记得声明深度纹理，Shader内才能使用
        half _BlurSize;
        float4x4 _PreviousViewProjectionMatrix;
        float4x4 _CurrentViewProjectionInverseMatrix;
        #include "UnityCG.cginc"

        struct v2f{
            float4 pos : SV_POSITION;
            half2 uv : TEXCOORD0;
            half2 uv_depth : TEXCOORD1;
        };

        v2f vert(appdata_img v){
            v2f o;
            o.pos = UnityObjectToClipPos(v.vertex);
            o.uv = v.texcoord;
            o.uv_depth = v.texcoord;
            #if UNITY_UV_STARTS_AT_TOP
                if(_MainTex_TexelSize.y < 0)
                    o.uv_depth.y = 1 - o.uv_depth.y;
            #endif
            return o;
        }

        fixed4 frag(v2f i) : SV_Target{
            float d=SAMPLE_DEPTH_TEXTURE(_cameraDepthTexture,i.uv_depth);//屏幕深度，0-1，非线性-重映射->NDC深度，-1-1，非线性
            float4 H=float4(i.uv.x*2-1,i.uv.y*2-1,d*2-1,1);//构造NDC坐标：i.uv是屏幕坐标，0-1，也需要重映射得到NDC坐标，-1-1.且NDC坐标是裁剪坐标经透视除法得到的，所以w=1
            float4 D=mul(_CurrentViewProjectionInverseMatrix,H);
            float4 worldPos = D/D.w;//透视除法后才得到世界坐标

            float4 currentPos = H;//当前的NDC坐标
            float4 previousPos = mul(_PreviousViewProjectionMatrix,worldPos);
            previousPos /= previousPos.w;//上一帧的NDC坐标

            float2 velocity = (currentPos.xy - previousPos.xy) / 2.0f;//NDC坐标差是currentPos.xy - previousPos.xy，根据NDC范围是-1-1，屏幕UV范围是0-1，所以NDC坐标差/2=屏幕UV坐标差，也就是像素在相邻两帧内移动的距离
            //为什么需要转成屏幕坐标差？
            //因为下边对uv偏移是在屏幕空间，并以速度作为每次偏移的大小和方向

            float2 uv = i.uv;
            fixed4 color = tex2D(_MainTex,uv);
            uv += velocity*_BlurSize;
            for(int it=1;it<3;it++,uv+=velocity*_BlurSize){//对沿速度方向的三个像素颜色进行平均
                color += tex2D(_MainTex,uv);
            }
            color /= 3;
            return fixed4(color.rgb,1.0);
        }
        ENDCG

        Pass
        {
            ZTest Always
            ZWrite Off
            Cull Off
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            ENDCG
        }
    }
    Fallback Off
}
```

# 雾效
## 1. 从深度纹理重建世界坐标
前文通过深度纹理重建世界坐标的方式，需要在片元着色器中执行两次矩阵乘法，运算开销较大、性能偏低。这里介绍一种更高效的实现思路：
结合**相机世界坐标**、**物体到相机的欧式距离**、**相机指向物体的射线方向**，推导出物体世界坐标。

1. 相机世界坐标：可直接通过 Unity 内置变量快速获取。
2. 像素射线方向：相机指向屏幕单个像素的射线方向，由相机指向屏幕四个顶点的射线方向，以像素 UV 为插值系数插值得到。因此需先计算相机到四个顶点的射线方向（通过向量运算实现）。
3. 方向标准化处理：将射线方向的 Z 分量归一为 1。在片元着色器中，**方向向量 × 线性深度**，即可算出相机到物体的欧式距离。

## 2. 雾效计算原理
雾效通过**雾效系数**混合物体原始颜色与雾颜色实现。根据雾效系数的计算公式，主要分为三类基础雾效，也可自定义系数算法实现特殊雾效：
- 线性雾
- 指数雾
- 平方指数雾

下面代码从深度纹理中重建世界坐标，并自定义雾效计算公式，实现了高度雾。
![BQACAgUAAyEGAASHRsPbAAEVfTxqLr6Rmm_doUDbrVIy3eq3yz8zYgAC1isAAhZseFWiargin0CyUDwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEVfTxqLr6Rmm_doUDbrVIy3eq3yz8zYgAC1isAAhZseFWiargin0CyUDwE.png)
```C#
using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class FogWithDepthTexture : PostEffectsBase
{
    public Shader fogShader;
    private Material fogMaterial;
    public Material material
    {
        get
        {
            fogMaterial = CheckShaderAndCreateMaterial(fogShader, fogMaterial);
            return fogMaterial;
        }
    }

    private Camera myCamera;
    public Camera camera
    {
        get
        {
            if (myCamera == null)
            {
                myCamera = GetComponent<Camera>();
            }
            return myCamera;
        }
    }

    private Transform myCameraTransform;
    public Transform cameraTransform
    {
        get
        {
            if (myCameraTransform == null)
            {
                myCameraTransform = camera.transform;
            }
            return myCameraTransform;
        }
    }

    [Range(0.0f, 3.0f)]
    public float fogDensity = 1.0f;
    public Color fogColor = Color.white;
    public float fogStart = 0.0f;
    public float fogEnd = 2.0f;

    void OnEnable()
    {
        camera.depthTextureMode |= DepthTextureMode.Depth;
    }
    public void OnRenderImage(RenderTexture src,RenderTexture dest)
    {
        if (material != null)
        {
            Matrix4x4 frustumCorners = Matrix4x4.identity;
            float fov = camera.fieldOfView;
            float near = camera.nearClipPlane;
            float far = camera.farClipPlane;
            float aspect = camera.aspect;

            float halfHeight = near * Mathf.Tan(fov * 0.5f * Mathf.Deg2Rad);//乘以Mathf.Deg2Rad：Mathf.Tan只接收Rad输入，而fov是角度(0-180)
            Vector3 toRight = cameraTransform.right * halfHeight * aspect;
            Vector3 toTop = cameraTransform.up * halfHeight;

            Vector3 topLeft = cameraTransform.forward * near + toTop - toRight;//相机到近裁剪面左上角的射线向量(x,y,z)，其中z=near
            float scale = topLeft.magnitude / near;//topLeft.magnitude=len

            topLeft.Normalize();//topLeft=(x/len,y/len,z/len)
            topLeft *= scale;//topLeft=(x/len,y/len,z/len)*(len/near)=(x/near,t/near,z/near)=(x/near,y/near,1)
            //通过Normalize然后又scale，把顶点的方向向量的z坐标变为1，之后乘以linearDepth，则z坐标就是物体真实的深度值
            //同时，上面的处理只是改变了射线的大小，方向没变。ray=(A,B,1),表示沿着射线步进时，在z轴上走1个单位，则在x轴上要走A个单位，在y轴上要走B个单位。

            Vector3 topRight = cameraTransform.forward * near + toTop + toRight;
            topRight.Normalize();
            topRight *= scale;

            Vector3 bottomLeft = cameraTransform.forward * near - toTop - toRight;
            bottomLeft.Normalize();
            bottomLeft *= scale;

            Vector3 bottomRight = cameraTransform.forward * near - toTop + toRight;
            bottomRight.Normalize();
            bottomRight *= scale;

            frustumCorners.SetRow(0, bottomLeft);//每个方向矢量都是Vector3的，但是frustumCorners定义的是Matrix4x4的，第四维自动填1
            frustumCorners.SetRow(1, bottomRight);
            frustumCorners.SetRow(2, topLeft);
            frustumCorners.SetRow(3, topRight);

            material.SetMatrix("_FrustumCornersRay", frustumCorners);
            material.SetFloat("_FogDensity", fogDensity);
            material.SetColor("_FogColor", fogColor);
            material.SetFloat("_FogStart", fogStart);
            material.SetFloat("_FogEnd", fogEnd);
            Graphics.Blit(src, dest, material);
        }
        else
        {
            Graphics.Blit(src, dest);
        }
    }
    // Start is called before the first frame update
    void Start()
    {
        
    }

    // Update is called once per frame
    void Update()
    {
        
    }
}
```
```glsl
Shader "Unlit/Chapter13-FogWithDepthTexture"
{
    Properties
    {
        _MainTex ("Texture", 2D) = "white" {}
        _FogDensity ("Fog Density",Float) = 1.0
        _FogColor ("Fog Color",Color) = (1,1,1,1)
        _FogStart ("Fog Start",Float) = 0.0
        _FogEnd ("Fog End",Float) = 2.0
    }
    SubShader
    {
        CGINCLUDE
        sampler2D _MainTex;
        half4 _MainTex_TexelSize;
        float _FogDensity;
        float _FogStart;
        float _FogEnd;
        fixed4 _FogColor;
        float4x4 _FrustumCornersRay;
        sampler2D _CameraDepthTexture;

        #include "UnityCG.cginc"

        struct v2f{
            float4 pos : SV_POSITION;
            float2 uv :TEXCOORD0;
            float2 uv_depth : TEXCOORD1;

            float4 interpolatedRay : TEXCOORD2;
        };

        v2f vert(appdata_img v){
            v2f o;
            o.pos=UnityObjectToClipPos(v.vertex);
            o.uv=v.texcoord;
            o.uv_depth=v.texcoord;
            #if UNITY_UV_STARTS_AT_TOP
                if(_MainTex_TexelSize.y < 0)
                    o.uv_depth.y=1-o.uv_depth.y;
            #endif

            int index=0;
            if(v.texcoord.x < 0.5 && v.texcoord.y < 0.5){
                index=0;
            }else if(v.texcoord.x>0.5 && v.texcoord.y < 0.5){
                index=1;
            }else if(v.texcoord.x < 0.5 && v.texcoord.y > 0.5){
                index=2;
            }else{
                index =3;
            }

            #if UNITY_UV_STARTS_AT_TOP
                if(_MainTex_TexelSize.y < 0)
                    index=3-index;
            #endif

            o.interpolatedRay=_FrustumCornersRay[index];//由于屏幕后处理处理的就是一块全屏四边形，只有四个顶点，所以根据顶点的uv判断它是左上/左下/右上/右下之一，赋值对应的方向向量。然后GPU根据像素的uv坐标自动在这四个顶点之间插值，得到像素的方向向量
            return o;
        }

        fixed4 frag(v2f i) : SV_Target{
            float linearDepth = LinearEyeDepth(SAMPLE_DEPTH_TEXTURE(_CameraDepthTexture,i.uv_depth));
            float3 worldPos = _WorldSpaceCameraPos+linearDepth*i.interpolatedRay.xyz;

            float fogDensity=(_FogEnd-worldPos.y)/(_FogEnd-_FogStart);
            fogDensity=saturate(fogDensity*_FogDensity);
            fixed4 finalColor=tex2D(_MainTex,i.uv);
            finalColor.rgb=lerp(finalColor.rgb,_FogColor.rgb,fogDensity);
            return finalColor;
        }
        ENDCG

        Pass
        {
            ZTest Always
            ZWrite Off
            Cull Off
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            ENDCG
        }
    }
    Fallback Off
}
```

# 边缘检测
传统边缘检测基于屏幕图像实现（Sobel算子）：先求取像素灰度值，再计算像素梯度，最终得到边缘系数。该方案**依赖画面颜色信息**，颜色差异并不代表真实几何边缘，容易产生大量虚假边缘。

优化方案：结合**深度+法线纹理**与 **Roberts 算子**做边缘检测
1. 采样当前像素及相邻像素的**深度值**与**法线值**；
2. 将相邻像素数据与当前像素做比对；
3. 设定判断阈值，差值在阈值范围内判定为同一表面；
4. 最终输出**非0即1**的二值化边缘系数，有效规避颜色带来的伪边缘问题。
![BQACAgUAAyEGAASHRsPbAAEVfUxqLr-LeHyL8QQ8-WViG9oFvykE6AAC5isAAhZseFXpYTCtTncFZzwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEVfUxqLr-LeHyL8QQ8-WViG9oFvykE6AAC5isAAhZseFXpYTCtTncFZzwE.png)
![BQACAgUAAyEGAASHRsPbAAEVfVBqLr-ri-HEg7eLRYOZZO3MYyMupgAC6isAAhZseFUhnj98GFpuTjwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEVfVBqLr-ri-HEg7eLRYOZZO3MYyMupgAC6isAAhZseFUhnj98GFpuTjwE.png)
![BQACAgUAAyEGAASHRsPbAAEVfVJqLr-52zEvDYGQ6GBPUbupLiONqQAC7CsAAhZseFXtLDk9mRT0ATwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEVfVJqLr-52zEvDYGQ6GBPUbupLiONqQAC7CsAAhZseFXtLDk9mRT0ATwE.png)
```C#
using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class EdgeDetectNormalsAndDepth : PostEffectsBase
{
    public Shader edgeDetectShader;
    private Material edgeDetectMaterial;
    public Material material
    {
        get
        {
            edgeDetectMaterial = CheckShaderAndCreateMaterial(edgeDetectShader, edgeDetectMaterial);
            return edgeDetectMaterial;
        }
    }

    [Range(0.0f, 1.0f)]
    public float edgeOnly = 0.0f;
    public Color edgeColor = Color.black;
    public Color backgroundColor = Color.white;
    public float sampleDistance = 1.0f;//值越大，边缘越粗：对某个像素点，到离它很远的地方去采样，远处像素点的深度和法线值更有可能与当前的像素点的深度和法线值差别大，即当前像素点越可能是边缘
    public float sensitivityDepth = 1.0f;//值越大，越敏感：稍微变化的深度和法线即被判定为边缘，则边缘线条增多，变粗
    public float sensitivityNormals = 1.0f;

    void OnEnable()
    {
        GetComponent<Camera>().depthTextureMode |= DepthTextureMode.DepthNormals;
    }

    [ImageEffectOpaque]
    public void OnRenderImage(RenderTexture src,RenderTexture dest)
    {
        if(material != null)
        {
            material.SetFloat("_EdgeOnly", edgeOnly);
            material.SetColor("_EdgeColor", edgeColor);
            material.SetColor("_BackgroundColor", backgroundColor);
            material.SetFloat("_SampleDistance", sampleDistance);
            material.SetVector("_Sensitivity", new Vector4(sensitivityNormals, sensitivityDepth, 0.0f, 0.0f));

            Graphics.Blit(src, dest, material);
        }
        else
        {
            Graphics.Blit(src, dest);
        }
    }
    // Start is called before the first frame update
    void Start()
    {
        
    }

    // Update is called once per frame
    void Update()
    {
        
    }
}
```
```glsl
Shader "Unlit/Chapter13-EdgeDetectNormalAndDepth"
{
    Properties
    {
        _MainTex ("Texture", 2D) = "white" {}
        _EdgeOnly("Edge Only",Float) = 0.0
        _EdgeColor("Edge Color",Color) = (0,0,0,1)
        _BackgroundColor("Background Color",Color) = (1,1,1,1)
        _SampleDistance("Sample Distance",Float)= 1.0
        _Sensitivity("Sensitivity",Vector) = (1,1,1,1)//xy分量分别对应法线和深度的检测灵敏度，zw分量没有实际意义
    }
    SubShader
    {
        CGINCLUDE
        sampler2D _MainTex;
        half4 _MainTex_TexelSize;
        sampler2D _CameraDepthNormalsTexture;
        float _EdgeOnly;
        fixed4 _EdgeColor;
        fixed4 _BackgroundColor;
        float _SampleDistance;
        half4 _Sensitivity;

        #include "UnityCG.cginc"

        struct v2f{
            float4 pos : SV_POSITION;
            float2 uv[5] : TEXCOORD0;//5个uv值分别存储：当前像素的uv（用来采样纹理得到当前像素的颜色），接下来四个uv值是Roberts算子的4个格子对应的像素值，是当前像素周围的四个像素的uv值，用于计算梯度，进而计算边缘
        };

        v2f vert(appdata_img v){
            v2f o;
            o.pos = UnityObjectToClipPos(v.vertex);
            half2 uv=v.texcoord;
            uv[0]=uv;

            #if UNITY_UV_STARTS_AT_TOP
                if(_MainTex_TexelSize.y < 0)
                    uv.y=1-uv.y;
            #endif
            //uv[0]是用于采样_MainTex的，而_MainTex是当前屏幕图像，unity会自动处理它的纹理规则，因此不需要翻转uv[0]
            //剩下四个uv是采样深度+法线纹理的，unity没有处理平台化差异，所以需要手动翻转

            o.uv[1]=uv + _MainTex_TexelSize.xy*float2(-1,-1)*_SampleDistance;
            o.uv[2]=uv + _MainTex_TexelSize.xy*float2(1,1)*_SampleDistance;
            o.uv[3]=uv + _MainTex_TexelSize.xy*float2(1,-1)*_SampleDistance;
            o.uv[4]=uv + _MainTex_TexelSize.xy*float2(-1,1)*_SampleDistance;

            return o;
        }

        half CheckSame(half4 center,half4 sample){
            half2 centerNormal=center.xy;//解码法线是把3D信息投影到2D，且编码解码保证3D上接近，2D上接近。这里只是为了比较法线是否相近，所以可以不用解码出具体值，2D上比较差异即可
            float centerDepth=DecodeFloatRG(center.zw);
            half2 sampleNormal=sample.xy;
            float sampleDepth=DecodeFloatRG(sample.zw);

            half2 diffNormal=abs(centerNormal-sampleNormal)*_Sensitivity.x;
            int isSameNormal=(diffNormal.x+diffNormal.y)<0.1;
            float diffDepth=abs(centerDepth-sampleDepth)*_Sensitivity.y;
            int isSameDepth=diffDepth<0.1*centerDepth;//深度判断不能直接diffDepth<xx，因为本来近处相邻像素间深度差异大，远处相邻像素间深度差异小，所以阈值不固定

            return isSameNormal*isSameDepth?1.0:0.0;

        }

        fixed4 frag(v2f i) : SV_Target{
            half4 sample1=tex2D(_CameraDepthNormalsTexture,i.uv[1]);
            half4 sample2=tex2D(_CameraDepthNormalsTexture,i.uv[2]);
            half4 sample3=tex2D(_CameraDepthNormalsTexture,i.uv[3]);
            half4 sample4=tex2D(_CameraDepthNormalsTexture,i.uv[4]);

            half edge=1.0;
            edge*=CheckSame(sample1,sample2);
            edge*=CheckSame(sample3,sample4);//Roberts算子是把两个方向的差值相乘

            fixed4 withEdgeColor=lerp(_EdgeColor,tex2D(_MainTex,i.uv[0]),edge);
            fixed4 edgeOnlyColor=lerp(_EdgeColor,_BackgroundColor,edge);

            fixed4 finalColor=lerp(withEdgeColor,edgeOnlyColor,_EdgeOnly);
            return finalColor;
        }
        ENDCG

        Pass
        {
            ZTest Always
            ZWrite Off
            Cull Off
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            ENDCG
        }
    }
    Fallback Off
}
```

# 非真实感渲染
## 1. 卡通风格渲染
### 1.1 轮廓线绘制
采用**两个 Pass** 实现轮廓效果：
1. **第一个 Pass**：渲染模型背面面片，在视角空间中将顶点沿法线向外偏移，偏移部分形成物体轮廓。
   问题优化：若直接沿原始法线偏移，内凹模型会出现背面遮挡正面的问题。解决方案为**法线扁平化处理**：偏移前将顶点法线的 Z 值置为 -1，再对法线重新归一化，让背面顶点统一朝远离相机方向偏移。
2. **第二个 Pass**：正常渲染模型正面面片。

### 1.2 卡通光照
- **漫反射**：卡通漫反射无线性过渡，通过漫反射系数采样**一维渐变纹理**，最终得到漫反射颜色。
- **高光**：理想状态为纯色分块区域。先计算法线与半角向量的点积，与阈值 `thre` 对比：大于阈值则高光系数为 1，小于则为 0。
  缺陷与优化：单纯二值判断会造成高光边缘马赛克。引入极小过渡阈值 `w`：
  - 点积结果 $< -w$：高光系数 = 0
  - 点积结果 $> w$：高光系数 = 1
  - 区间 $[-w, w]$ 内：使用线性插值计算系数，实现高光边缘平滑过渡。
![BQACAgUAAyEGAASHRsPbAAEVfVhqLsBwML-aVrTXZF3oOOZxnfOILgAC8isAAhZseFWwpUH4Jk6O8zwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEVfVhqLsBwML-aVrTXZF3oOOZxnfOILgAC8isAAhZseFWwpUH4Jk6O8zwE.png)
```glsl
// Upgrade NOTE: replaced 'mul(UNITY_MATRIX_MVP,*)' with 'UnityObjectToClipPos(*)'

Shader "Unlit/Chapter14-ToonShading"
{
    Properties
    {
        _Color ("Color Tint",Color) = (1,1,1,1)
        _MainTex ("Texture", 2D) = "white" {}
        _Ramp ("Ramp Texture",2D) = "white"{}
        _Outline ("Outline",Range(0,1)) = 0.1//背面顶点向外推移的距离
        _OutlineColor ("Outline Color",Color) = (0,0,0,1)
        _Specular ("Specular Color",Color) = (1,1,1,1)
        _SpecularScale ("Specular Scale",Range(0,0.1)) = 0.01
    }
    SubShader
    {
        Pass
        {
            NAME "OUTLINE"
            Cull Front
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag

            fixed4 _Color;
            float _Outline;
            fixed4 _OutlineColor;

            #include "UnityCG.cginc"

            struct a2v
            {
                float4 vertex : POSITION;
                float3 normal : NORMAL;
            };

            struct v2f
            {
                float4 pos : SV_POSITION;
            };

            v2f vert (a2v v)
            {
                v2f o;
                float4 pos = mul(UNITY_MATRIX_MV,v.vertex);//把顶点从模型空间变换到视图空间，乘以MV矩阵
                float3 normal = mul((float3x3)UNITY_MATRIX_IT_MV,v.normal);//把法线从模型空间变换到视图空间，乘以MV矩阵的逆转置矩阵
                normal.z=-0.5;//z越小离相机越远，把z设为负值，以此稍微远离相机，使得顶点扩张时朝远离相机的方向，不遮挡前面的正面面片
                normal=normalize(normal);
                pos=pos+float4(normal,0)*_Outline;//法线是向量，齐次坐标是0表示方向
                o.pos = mul(UNITY_MATRIX_P,pos);//最后把顶点从视图空间变换到裁剪空间，乘以P矩阵
                return o;
            }

            fixed4 frag (v2f i) : SV_Target
            {
                return fixed4(_OutlineColor.rgb,1.0);//背面面片全部涂成轮廓颜色，这样正面面片渲染完之后，挡住了部分背面面片，露出来的就是边缘
            }
            ENDCG
        }

        Pass{
            Tags {"LightMode" = "ForwardBase"}//正面渲染需要计算光照
            Cull Back
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile_fwdbase

            fixed4 _Color;
            sampler2D _MainTex;
            float4 _MainTex_ST;
            sampler2D _Ramp;
            float _Outline;
            fixed4 _OutlineColor;
            fixed4 _Specular;
            float _SpecularScale;

            #include "Lighting.cginc"
            #include "AutoLight.cginc"

            struct a2v
            {
                float4 vertex : POSITION;
                float2 texcoord : TEXCOORD0;
                float3 normal :NORMAL;
            };

            struct v2f
            {
                float4 pos : SV_POSITION;
                float2 uv :TEXCOORD0;
                float3 worldNormal :TEXCOORD1;
                float3 worldPos :TEXCOORD2;
                SHADOW_COORDS(3)
            };

            v2f vert (a2v v)
            {
                v2f o;
                o.pos = UnityObjectToClipPos(v.vertex);
                o.uv = TRANSFORM_TEX(v.texcoord,_MainTex);
                o.worldNormal = UnityObjectToWorldNormal(v.normal);
                o.worldPos = mul(unity_ObjectToWorld,v.vertex).xyz;
                TRANSFER_SHADOW(o);
                return o;
            }

            fixed4 frag (v2f i) : SV_Target
            {
                float3 worldNormal = normalize(i.worldNormal);
                float3 worldLightDir = normalize(UnityWorldSpaceLightDir(i.worldPos));
                float3 worldViewDir = normalize(UnityWorldSpaceViewDir(i.worldPos));
                float3 halfDir = normalize(worldLightDir+worldViewDir);

                fixed4 texColor = tex2D(_MainTex,i.uv);
                fixed3 albedo = texColor.rgb*_Color.rgb;
                fixed3 ambient = UNITY_LIGHTMODEL_AMBIENT.rgb*albedo;

                UNITY_LIGHT_ATTENUATION(atten,i,i.worldPos);

                fixed diff=dot(worldNormal,worldLightDir);
                diff = (diff*0.5+0.5)*atten;//-1-1->0-1,才可以采样纹理图。在这里就把atten乘上，使得暗的地方更暗，而不是最后整体变灰

                fixed3 diffuse = _LightColor0.rgb * albedo * tex2D(_Ramp,float2(diff,diff)).rgb;//用diff去采样_Ramp，tex2D得到的颜色作为另一种形式的漫反射系数

                fixed spec=dot(worldNormal,halfDir);
                fixed w = fwidth(spec)*2.0;//fwidth求当前像素和周围像素的导数，*2是为了使高光过渡区域更大，更柔和
                fixed3 specular = _Specular.rgb * lerp(0,1,smoothstep(-w,w,spec+_SpecularScale-1)) * step(0.0001,_SpecularScale);//其实不太理解这里的smoothstep中的表达式spec+_SpecularScale

                return fixed4(ambient+diffuse+specular,1.0);
                
            }
            ENDCG
        }
    }
    Fallback "Diffuse"
}
```
## 2. 素描风格渲染
### 2.1 轮廓描边
复用卡通轮廓线的背面偏移 Pass 实现描边效果。

### 2.2 笔触线条（TAM 技术）
使用**6 张笔触纹理**，纹理笔触数量依次递增，用笔触疏密模拟光照明暗：笔触越少画面越亮，笔触越多画面越暗。每张纹理配备特殊多级渐远纹理（保留笔触间距，非普通下采样）。

#### 实现逻辑
1. **顶点着色器**
   计算漫反射系数，并将数值映射到 $[0,7]$ 区间，划分为 7 个分段：$0\sim1、1\sim2、2\sim3、3\sim4、4\sim5、5\sim6、6\sim7$。
   - $0\sim6$：分为 6 个区间，每个区间仅相邻两张纹理权重非零；第六区间（$5\sim6$）仅第六张纹理生效。
   - $6\sim7$：输出纯白色，模拟高光区域。

2. **片元着色器**
   使用像素 UV 分别采样 6 张笔触纹理，结合前文计算的权重混合纹理颜色，最后叠加高光白色，得到最终素描画面。
![BQACAgUAAyEGAASHRsPbAAEVfVlqLsCg95MP_MG-Qj6jlBkWxhOeLQAC8ysAAhZseFVt3n6sFasJWzwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEVfVlqLsCg95MP_MG-Qj6jlBkWxhOeLQAC8ysAAhZseFVt3n6sFasJWzwE.png)
```glsl
Shader "Unlit/Chapter14-Hatching"
{
    Properties
    {
        _Color ("Color Tint",Color) = (1,1,1,1)
        _TileFactor ("Tile Factor",Float) = 1
        _Outline ("Outline Offset",Range(0,1)) = 0.1
        _Hatch0 ("Hatch 0",2D) = "white"{}
        _Hatch1 ("Hatch 1",2D) = "white"{}
        _Hatch2 ("Hatch 2",2D) = "white"{}
        _Hatch3 ("Hatch 3",2D) = "white"{}
        _Hatch4 ("Hatch 4",2D) = "white"{}
        _Hatch5 ("Hatch 5",2D) = "white"{}
    }
    SubShader
    {
        Tags {"RenderType" = "Opaque" "Queue" = "Geometry"}

        UsePass "Unlit/Chapter14-ToonShading/OUTLINE"

        Pass
        {
            Tags {"LightMode" = "ForwardBase"}
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile_fwdbase

            #include "Lighting.cginc"
            #include "AutoLight.cginc"

            fixed4 _Color;
            float _TileFactor;
            sampler2D _Hatch0;
            sampler2D _Hatch1;
            sampler2D _Hatch2;
            sampler2D _Hatch3;
            sampler2D _Hatch4;
            sampler2D _Hatch5;

            struct a2v
            {
                float4 vertex : POSITION;
                float2 texcoord : TEXCOORD0;
                float3 normal : NORMAL;
            };

            struct v2f
            {
                float2 uv : TEXCOORD0;
                float4 pos : SV_POSITION;
                float3 worldPos : TEXCOORD1;
                fixed3 hatchWeight0 : TEXCOORD2;
                fixed3 hatchWeight1 : TEXCOORD3;//六个纹理，声明两个fixed3的变量存储
                SHADOW_COORDS(4)
            };

            v2f vert (a2v v)
            {
                v2f o;
                o.pos = UnityObjectToClipPos(v.vertex);
                o.uv = v.texcoord*_TileFactor;//素描排线贴图不需要像外观贴图一样应用材质面板的平铺和缩放，只受_TileFactor控制，所以无需TRANSFORM_TEX
                float3 worldNormal=UnityObjectToWorldNormal(v.normal);
                o.worldPos = mul(unity_ObjectToWorld,v.vertex).xyz;
                float3 worldSpaceLightDir = normalize(UnityWorldSpaceLightDir(o.worldPos));

                fixed diff=saturate(dot(worldNormal,worldSpaceLightDir));//将diff钳制到0-1，就不用重映射了
                float hatchFactor=diff*7.0;

                o.hatchWeight0=fixed3(0,0,0);
                o.hatchWeight1=fixed3(0,0,0);//初始化六张图的权重，因为下面的分支中只给涉及到的纹理赋值，所以其他纹理的权重应该保持0

                if(hatchFactor > 6.0){
                    //do nothing
                }else if(hatchFactor > 5.0){
                    o.hatchWeight0.x = hatchFactor - 5.0;
                }else if(hatchFactor > 4.0){
                    o.hatchWeight0.x = hatchFactor - 4.0;
                    o.hatchWeight0.y = 1 - o.hatchWeight0.x;
                }else if(hatchFactor > 3.0){
                    o.hatchWeight0.y = hatchFactor - 3.0;
                    o.hatchWeight0.z = 1 - o.hatchWeight0.y;
                }else if(hatchFactor > 2.0){
                    o.hatchWeight0.z = hatchFactor - 2.0;
                    o.hatchWeight1.x = 1 - o.hatchWeight0.z;
                }else if(hatchFactor > 1.0){
                    o.hatchWeight1.x = hatchFactor - 1.0;
                    o.hatchWeight1.y = 1 - o.hatchWeight1.x;
                }else {
                    o.hatchWeight1.y = hatchFactor;
                    o.hatchWeight1.z = 1 - o.hatchWeight1.y;
                }

                TRANSFER_SHADOW(o);
                return o;
            }

            fixed4 frag (v2f i) : SV_Target
            {
                fixed4 hatch0Color = tex2D(_Hatch0,i.uv)*i.hatchWeight0.x;
                fixed4 hatch1Color = tex2D(_Hatch1,i.uv)*i.hatchWeight0.y;
                fixed4 hatch2Color = tex2D(_Hatch2,i.uv)*i.hatchWeight0.z;
                fixed4 hatch3Color = tex2D(_Hatch3,i.uv)*i.hatchWeight1.x;
                fixed4 hatch4Color = tex2D(_Hatch4,i.uv)*i.hatchWeight1.y;
                fixed4 hatch5Color = tex2D(_Hatch5,i.uv)*i.hatchWeight1.z;

                //没有排线的地方应该是纯白，纯白分量=纯白颜色*纯白占比
                fixed4 whiteColor = fixed4(1,1,1,1) * (1-i.hatchWeight0.x - i.hatchWeight0.y - i.hatchWeight0.x - i.hatchWeight1.x - i.hatchWeight1.y - i.hatchWeight1.z);

                //最终颜色=所有排线颜色分量+纯白分量
                fixed4 hatchColor = hatch0Color+hatch1Color+hatch2Color+hatch3Color+hatch4Color+hatch5Color+whiteColor;

                UNITY_LIGHT_ATTENUATION(atten,i,i.worldPos);//在这里要用worldPos

                return fixed4(hatchColor.rgb * _Color.rgb * atten,1.0);//记得乘以物体原始的颜色
            }
            ENDCG
        }
    }
    Fallback "Diffuse"
}
```


# 噪声纹理
## 1. 消融效果
### 原理
1. 基础剔除逻辑
使用噪声贴图采样当前像素的消融系数，和自定义消融程度阈值对比：
- 若采样值小于消融程度阈值：像素不通过测试，执行`clip`剔除像素；
- 消融程度可理解为门槛：阈值越高，通过测试像素越少，剔除像素越多，消融破损效果越明显。

2. 消融边缘渐变上色
在被剔除的烧焦区域周边，通过`_LineWidth`参数划定消融扩散边缘范围：
- 计算边缘区域像素对应的消融程度；
- 用该消融程度插值两种边界消融色（靠近消融中心深色、靠近正常物体浅色）；
- 将插值后的消融色与物体基础正常色混合，实现烧焦渐变边缘。

3. 阴影适配处理
片元着色器使用`clip`剔除像素后，原生阴影渲染会失效，需单独自定义`ShadowCaster Pass`保证阴影显示正确。
![BQACAgUAAyEGAASHRsPbAAEV1QZqN_HSWpL46BO0uMK_r7Gc77v26wACZSIAAqOTwVU_k9VwQJ5hBzwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEV1QZqN_HSWpL46BO0uMK_r7Gc77v26wACZSIAAqOTwVU_k9VwQJ5hBzwE.png)
```glsl
Shader "Unlit/Chapter15-Dissolve"
{
    Properties
    {
        _BurnAmount ("Burn Amount",Range(0.0,1.0)) = 0.0
        _LineWidth ("Line Width",Range(0.0,0.2)) = 0.1//在这个消融的像素周围lineWidth范围内，将显示烧焦的颜色
        _MainTex ("Main Texture",2D) = "white"{}
        _BumpMap ("Bump Map",2D) = "bump"{}
        _BurnFirstColor ("Burn First Color",Color) = (1,0,0,1)
        _BurnSecondColor ("Burn Second Color",Color) = (1,0,0,1)
        _BurnMap ("Burn Noise Map",2D) = "white"{}
    }
    SubShader
    {

        Pass
        {
            Tags {"LightMode" = "ForwardBase" "RenderType" = "TransparentCutout" "Queue" = "AlphaTest" "IgnoreProjector" = "True"}
            Cull Off//消融会裸露模型内部的构造，如果只渲染正面会导致正面被消融后，直接看到背景，模型看起来只有单面结构
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile_fwdbase

            #include "Lighting.cginc"
            #include "AutoLight.cginc"

            float _BurnAmount;
            float _LineWidth;
            sampler2D _MainTex;
            float4 _MainTex_ST;
            sampler2D _BumpMap;
            float4 _BumpMap_ST;
            fixed4 _BurnFirstColor;
            fixed4 _BurnSecondColor;
            sampler2D _BurnMap;
            float4 _BurnMap_ST;

            struct a2v
            {
                float4 vertex : POSITION;
                float2 texcoord : TEXCOORD0;
                float3 normal : NORMAL;
                float4 tangent : TANGENT;
            };

            struct v2f
            {
                float2 uvMainTex : TEXCOORD0;
                float2 uvBumpMap : TEXCOORD1;
                float2 uvBurnMap : TEXCOORD2;
                float4 pos : SV_POSITION;
                float3 tangentLightDir : TEXCOORD3;
                float3 worldPos : TEXCOORD4;
                SHADOW_COORDS(5)
            };

            v2f vert (a2v v)
            {
                v2f o;
                o.pos = UnityObjectToClipPos(v.vertex);
                o.uvMainTex = TRANSFORM_TEX(v.texcoord, _MainTex);
                o.uvBumpMap = TRANSFORM_TEX(v.texcoord, _BumpMap);
                o.uvBurnMap = TRANSFORM_TEX(v.texcoord, _BurnMap);
                TANGENT_SPACE_ROTATION;//这一宏的作用是什么？
                o.tangentLightDir = mul(rotation,ObjSpaceLightDir(v.vertex)).xyz;

                o.worldPos = mul(unity_ObjectToWorld,v.vertex).xyz;
                TRANSFER_SHADOW(o);
                return o;
            }

            fixed4 frag (v2f i) : SV_Target
            {
                fixed3 burn = tex2D(_BurnMap,i.uvBurnMap).rgb;
                clip(burn.r-_BurnAmount);//使用rgb哪个通道都无所谓，本来burn就是一个随机值，取其中一个通道只是为了和_BurnAmount的通道数对齐
                //burn.r < _BurnAmount：丢弃，是消融区域
                //burn.r >= _BurnAmount：保留

                float3 tangentLightDir = normalize(i.tangentLightDir);
                float3 tangentNormalDir = UnpackNormal(tex2D(_BumpMap,i.uvBumpMap));

                fixed3 albedo = tex2D(_MainTex,i.uvMainTex).rgb;
                fixed3 ambient = UNITY_LIGHTMODEL_AMBIENT.xyz*albedo;

                fixed3 diffuse = _LightColor0.rgb*albedo*saturate(dot(tangentLightDir,tangentNormalDir));

                fixed t=1-smoothstep(0.0,_LineWidth,burn.r-_BurnAmount);
                //在_LineWidth范围内计算一个烧焦程度，t越接近1，说明烧焦程度越大，则像素越接近烧焦中心
                fixed3 burnColor = lerp(_BurnFirstColor,_BurnSecondColor,t);
                //完全消融时使用第二种颜色
                burnColor=pow(burnColor,5);
                //让颜色更鲜艳

                UNITY_LIGHT_ATTENUATION(atten,i,i.worldPos);

                fixed3 finalColor = lerp(ambient+diffuse*atten,burnColor,t*step(0.0001,_BurnAmount));
                //使用烧焦程度对正常颜色（未烧）和烧焦颜色之间混合
                //step(0.0001,_BurnAmount)起到开关的作用，当_BurnAmount=0，则没有任何区域被烧焦

                return fixed4(finalColor,1.0);
            }
            ENDCG
        }

        Pass{
            Tags {"LightMode" = "ShadowCaster"}
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile_shadowcaster

            #include "UnityCG.cginc"

            float _BurnAmount;
            sampler2D _BurnMap;
            float4 _BurnMap_ST;

            struct a2v
            {
                float4 vertex : POSITION;
                float2 texcoord : TEXCOORD0;
                float3 normal : NORMAL;
            };

            struct v2f
            {
                float2 uvBurnMap : TEXCOORD2;
                V2F_SHADOW_CASTER;
            };

            v2f vert (a2v v)
            {
                v2f o;
                TRANSFER_SHADOW_CASTER_NORMALOFFSET(o)
                o.uvBurnMap = TRANSFORM_TEX(v.texcoord, _BurnMap);
                return o;
            }

            fixed4 frag (v2f i) : SV_Target
            {
                fixed3 burn = tex2D(_BurnMap,i.uvBurnMap).rgb;
                clip(burn.r-_BurnAmount);

               SHADOW_CASTER_FRAGMENT(i)
            }
            ENDCG
        }
    }
}
```
## 2. 反射、折射与凹凸噪声
### 反射效果
沿视线反射方向采样立方体贴图，得到物体环境反射颜色。

### 折射效果
1. 通过`GrabPass`抓取当前屏幕渲染图像；
2. 基于模型法线偏移屏幕UV坐标；
3. 使用偏移后的UV采样抓取的屏幕纹理，模拟透光折射变形。

### 噪声纹理凹凸作用
噪声图作为**切线空间法线贴图**使用，片元着色器修改像素法线向量：法线改变后光照计算结果偏移，视觉呈现表面凹凸起伏。
灰度噪声转法线贴图设置流程：
1. Texture Type 设置为 `Normal map`；
2. 勾选 `Create from grayscale`，自动由灰度图生成法线纹理。
![BQACAgUAAyEGAASHRsPbAAEV1Q1qN_IWWv0a7p6xfYlGl1RDBJIWUQACbSIAAqOTwVV6-tP7MM1tmDwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEV1Q1qN_IWWv0a7p6xfYlGl1RDBJIWUQACbSIAAqOTwVV6-tP7MM1tmDwE.png)
```glsl
Shader "Unlit/Chapter15-WaterWave"
{
    Properties
    {
        _MainTex ("Texture", 2D) = "white" {}
        _Color ("Color Tint",Color) = (0,0.15,0.115,1)
        _WaveMap ("Wave Map",2D) = "white"{}//噪声纹理，用于生成法线纹理
        _CubeMap ("Cube Map",Cube) = "_Skybox"{}//反射采样的立方体贴图
        _Distortion ("Distortion",Range(0,100)) = 10//折射偏折的程度
        _WaveXSpeed ("Wave Horizontal Speed",Range(-0.1,0.1)) = 0.01
        _WaveYSpeed ("Wave Vertical Speed",Range(-0.1,0.1)) = 0.01//这两个变量分别是控制采样法线纹理的UV在水平和竖直方向的移动速度，也就是控制法线纹理在水平和竖直方向的移动速度
    }
    SubShader
    {
        Tags { "RenderType"="Transparent" "Queue" = "Transparent" "IgnoreProjector" = "True" }//把Queue设置为Transparent，可以保证在渲染水面时，其他物体都已经渲染好了，这样可以透过水面看到其他物体
        GrabPass {"_RefractionTex"}//记得写抓屏，才能获取到折射效果所需的纹理

        Pass
        {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag

            #include "Lighting.cginc"

            sampler2D _MainTex;
            float4 _MainTex_ST;
            fixed4 _Color;
            sampler2D _WaveMap;
            float4 _WaveMap_ST;
            samplerCUBE _CubeMap;
            float _Distortion;
            float _WaveXSpeed;
            float _WaveYSpeed;
            sampler2D _RefractionTex;
            half4 _RefractionTex_TexelSize;

            struct a2v
            {
                float4 vertex : POSITION;
                float2 texcoord : TEXCOORD0;
                float3 normal : NORMAL;
                float4 tangent : TANGENT;//涉及法线纹理，需要normal和tanget进行空间变换
            };

            struct v2f
            {
                float4 uv : TEXCOORD0;//xy分量是_MainTex，zw分量是_WaveMap
                float4 pos : SV_POSITION;
                float4 srcPos : TEXCOORD1;//GrabPass获得的是屏幕纹理，需要屏幕UV采样
                float4 TtoW0  : TEXCOORD2;
                float4 TtoW1 : TEXCOORD3;
                float4 TtoW2 : TEXCOORD4;//涉及法线纹理，且在世界空间计算光照
            };

            v2f vert (a2v v)
            {
                v2f o;
                o.pos = UnityObjectToClipPos(v.vertex);
                o.uv.xy = TRANSFORM_TEX(v.texcoord, _MainTex);
                o.uv.zw = TRANSFORM_TEX(v.texcoord, _WaveMap);
                o.srcPos = ComputeGrabScreenPos(o.pos);

                float3 worldPos = mul(unity_ObjectToWorld,v.vertex).xyz;
                float3 worldNormal = UnityObjectToWorldNormal(v.normal);
                float3 worldTangent = UnityObjectToWorldDir(v.tangent).xyz;
                float3 worldBinormal = cross(worldNormal,worldTangent)*v.tangent.w;

                o.TtoW0 = float4(worldTangent.x,worldNormal.x,worldBinormal.x,worldPos.x);
                o.TtoW1 = float4(worldTangent.y,worldNormal.y,worldBinormal.y,worldPos.y);
                o.TtoW2 = float4(worldTangent.z,worldNormal.z,worldBinormal.z,worldPos.z);

                return o;
            }

            fixed4 frag (v2f i) : SV_Target
            {
                float3 worldPos = float3(i.TtoW0.w,i.TtoW1.w,i.TtoW2.w);
                fixed3 worldViewDir = normalize(UnityWorldSpaceViewDir(worldPos));
                float speed = _Time.y * (_WaveXSpeed+_WaveYSpeed);//为什么把两个方向的速度加起来，这有什么实际含义？

                fixed3 bump1 = UnpackNormal(tex2D(_WaveMap,i.uv.zw + speed)).rgb;//用时间相关的变量对法线纹理采样
                fixed3 bump2 = UnpackNormal(tex2D(_WaveMap,i.uv.zw - speed)).rgb;//对UV的偏移一个是+，一个是-：模拟两层交叉的水面流动

                fixed3 bump = normalize(bump1+bump2);

                float2 offset = bump.xy * _Distortion * _RefractionTex_TexelSize.xy;

                i.srcPos.xy = offset*i.srcPos.z + i.srcPos.xy;//把偏移量和屏幕坐标的z分量相乘，这是为了模拟深度越大、折射程度越大的效果

                fixed3 refrCol = tex2D(_RefractionTex,i.srcPos.xy/i.srcPos.w).rgb;//为什么需要除以w，而且除以w之后不还是-1-1的范围吗，但是UV不是要求0-1？

                bump = normalize(half3(dot(i.TtoW0.xyz,bump),dot(i.TtoW1.xyz,bump),dot(i.TtoW2.xyz,bump)));//把法线从切线空间变换到世界空间

                fixed4 texColor = tex2D(_MainTex,i.uv.xy);
                fixed3 reflDir = reflect(-worldViewDir,bump);
                fixed3 reflCol = texCUBE(_CubeMap,reflDir).rgb * texColor.rgb * _Color.rgb;

                fixed fresnel = pow(1-saturate(dot(worldViewDir,bump)),4);
                fixed3 finalColor = reflCol * fresnel + refrCol * (1-fresnel);

                return fixed4(finalColor,1.0);
                
            }
            ENDCG
        }
    }
}
```
## 3. 全局雾效（噪声扰动雾）
1. 引入随时间自增变量偏移雾采样UV，动态采样噪声贴图，获取实时变化的噪声强度；
2. 将噪声强度叠加至基础雾浓度，得到带扰动的最终雾浓度系数；
3. 基于新雾浓度系数，对物体原始颜色与雾颜色做线性插值，实现云雾流动、分层扰动效果。
![BQACAgUAAyEGAASHRsPbAAEV1RBqN_JXjJWAIMf_uD_ISw38ZANSVwACcCIAAqOTwVVFOuTSBNcKizwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEV1RBqN_JXjJWAIMf_uD_ISw38ZANSVwACcCIAAqOTwVVFOuTSBNcKizwE.png)
```C#
using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class FogWithNoise : PostEffectsBase
{
    public Shader fogWithNoiseShader;
    private Material fogWithNoiseMaterial;
    public Material material
    {
        get
        {
            fogWithNoiseMaterial = CheckShaderAndCreateMaterial(fogWithNoiseShader, fogWithNoiseMaterial);
            return fogWithNoiseMaterial;
        }
    }

    private Camera myCamera;
    public Camera camera
    {
        get
        {
            if (myCamera == null)
            {
                myCamera = GetComponent<Camera>();
            }
            return myCamera;
        }
    }

    private Transform myCameraTransform;
    public Transform cameraTransform
    {
        get
        {
            if(myCameraTransform == null)
            {
                myCameraTransform = camera.transform;
            }
            return myCameraTransform;
        }
    }

    [Range(0.1f, 3.0f)]
    public float fogDensity = 1.0f;
    public float fogStart = 0.0f;
    public float fogEnd = 2.0f;
    public Color fogColor = Color.white;
    public Texture noiseTexture;
    [Range(-0.5f, 0.5f)]
    public float fogXSpeed;
    [Range(-0.5f, 0.5f)]
    public float fogYSpeed;
    [Range(0.0f, 3.0f)]
    public float noiseAmount = 1.0f;//控制噪声程度，当noiseAmount=0时得到一个全局均匀的雾效

    void OnEnable()
    {
        camera.depthTextureMode |= DepthTextureMode.Depth;
    }

    void OnRenderImage(RenderTexture src,RenderTexture dest)
    {
        if(material != null)
        {
            Matrix4x4 frustumCorners = Matrix4x4.identity;

            float fov = camera.fieldOfView;
            float near = camera.nearClipPlane;
            float far = camera.farClipPlane;
            float aspect = camera.aspect;

            float halfHeight = near * Mathf.Tan(fov * 0.5f * Mathf.Deg2Rad);
            Vector3 toRight = cameraTransform.right * halfHeight * aspect;
            Vector3 toUp = cameraTransform.up * halfHeight;

            Vector3 topLeft = cameraTransform.forward * near + toUp - toRight;
            float scale = topLeft.magnitude / near;

            topLeft.Normalize();
            topLeft *= scale;

            Vector3 topRight = cameraTransform.forward * near + toUp + toRight;
            topRight.Normalize();
            topRight *= scale;

            Vector3 bottomLeft = cameraTransform.forward * near - toUp - toRight;
            bottomLeft.Normalize();
            bottomLeft *= scale;

            Vector3 bottomRight = cameraTransform.forward * near - toUp + toRight;
            bottomRight.Normalize();
            bottomRight *= scale;

            frustumCorners.SetRow(0, bottomLeft);
            frustumCorners.SetRow(1, bottomRight);
            frustumCorners.SetRow(2, topLeft);
            frustumCorners.SetRow(3, topRight);

            material.SetMatrix("_FrustumCornersRay", frustumCorners);
            material.SetFloat("_FogDensity", fogDensity);
            material.SetFloat("_FogStart", fogStart);
            material.SetFloat("_FogEnd", fogEnd);
            material.SetColor("_FogColor", fogColor);
            material.SetTexture("_NoiseTexture", noiseTexture);
            material.SetFloat("_FogXSpeed", fogXSpeed);
            material.SetFloat("_FogYSpeed", fogYSpeed);
            material.SetFloat("_NoiseAmount", noiseAmount);
            Graphics.Blit(src, dest,material);
        }
        else
        {
            Graphics.Blit(src, dest);
        }
    }
    // Start is called before the first frame update
    void Start()
    {
        
    }

    // Update is called once per frame
    void Update()
    {
        
    }
}
```
```glsl
Shader "Unlit/FogWithNoiseShader"
{
    Properties
    {
        _MainTex ("Texture", 2D) = "white" {}
        _FogDensity("Fog Density",Float) = 1.0
        _FogStart ("Fog Start",Float) = 0.0
        _FogEnd ("Fog End",Float) = 2.0
        _NoiseTexture ("Noise Texture",2D) = "white"{}
        _FogColor ("Fog Color",Color) = (1,1,1,1)
        _FogXSpeed ("Fog X Speed",Float) = 0.1
        _FogYSpeed ("Fog Y Speed",Float) = 0.1
        _NoiseAmount ("Noise Amount",Float) = 1
    }
    SubShader
    {
        CGINCLUDE
        sampler2D _MainTex;
        half4 _MainTex_TexelSize;
        sampler2D _CameraDepthTexture;
        half _FogDensity;
        float _FogStart;
        float _FogEnd;
        fixed4 _FogColor;
        sampler2D _NoiseTexture;
        half _FogXSpeed;
        half _FogYSpeed;
        half _NoiseAmount;

        float4x4 _FrustumCornersRay;

        #include "UnityCG.cginc"

        struct v2f{
            float4 pos : SV_POSITION;
            float2 uv : TEXCOORD0;
            float2 uv_depth : TEXCOORD1;

            float4 interpolatedRay : TEXCOORD2;
        };

        v2f vert(appdata_img v){
            v2f o;
            o.pos = UnityObjectToClipPos(v.vertex);
            o.uv = v.texcoord;
            o.uv_depth = v.texcoord;
            #if UNITY_UV_STARTS_AT_TOP
                if(_MainTex_TexelSize.y < 0)
                    o.uv_depth.y = 1 - o.uv_depth.y;
            #endif

            int index=0;
            if(v.texcoord.x < 0.5 && v.texcoord.y < 0.5){
                index=0;
            }else if(v.texcoord.x > 0.5 && v.texcoord.y < 0.5){
                index=1;
            }else if(v.texcoord.x < 0.5 && v.texcoord.y > 0.5){
                index=2;
            }else{
                index=3;
            }

            #if UNITY_UV_STARTS_AT_TOP
                if(_MainTex_TexelSize.y < 0)
                    index=3-index;
            #endif

            o.interpolatedRay = _FrustumCornersRay[index];
            return o;
        }

        fixed4 frag(v2f i) : SV_Target{
            float linearDepth = LinearEyeDepth(SAMPLE_DEPTH_TEXTURE(_CameraDepthTexture,i.uv_depth));
            float3 worldPos = _WorldSpaceCameraPos + linearDepth * i.interpolatedRay.xyz;

            float2 speed = _Time.y * float2(_FogXSpeed,_FogYSpeed);
            float noise = (tex2D(_NoiseTexture,i.uv + speed).r) * _NoiseAmount;//计算噪声强度：一部分随时间变化，另一部分是全局控制。噪声图是灰度图，RGB三个分量相等，且由于结果是系数，所以取一个就行

            float fogDensity = (_FogEnd - worldPos.y) / (_FogEnd - _FogStart);
            fogDensity = saturate(fogDensity * _FogDensity * (1 + noise));//1+noise是因为是在原来雾浓度（fogDensity*_FogDensity)上叠加噪声，而非用噪声控制整体雾浓度

            fixed4 finalColor = tex2D(_MainTex,i.uv);
            finalColor.rgb = lerp(finalColor.rgb,_FogColor.rgb,fogDensity);
            return finalColor;
        }
        ENDCG

        Pass
        {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            ENDCG
        }
    }
    Fallback Off
}
```
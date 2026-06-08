---
title: Unity Shader 入门精要学习
published: 2026-05-14
description: '学习《Unity Shader 入门精要》的笔记，包括示例实验代码'
#image: ''
tags: [Unity,Shader]
category: '学习笔记'
draft: false 
lang: 'zh'
---
# 半透明物体的渲染

## 知识点

**整体思路**
1. 先渲染所有不透明物体，开启深度测试和深度写入
2. 把所有半透明物体按他们距离摄像机的远近进行排序，然后按照从后往前的顺序渲染。开启深度测试，但关闭深度写入

**仍然存在的问题**
1. 深度测试是逐像素比较，而排序是逐物体的，即要么A排在B前面，要么B排在A前面。如果AB存在循环重叠/互相遮挡，则永远得不到正确的排序结果。
2. 物体可能涵盖多个像素，每个像素的深度可能都不一致，选用哪一个像素的深度代表物体的深度，可能得到不同的深度排序结果。

**解决思路**
将物体分割，对分割后的物体再进行深度排序。尽可能让模型是凸面体，并且考虑将复杂模型拆分成可以独立排序的多个子模型。如果不想分割，可以让透明通道更为柔和，使穿插看起来不那么明显。也可使用开启了深度写入的半透明效果。

## 快速开始

## 透明度测试
片元的透明度大于阈值则保留，完全显示；否则舍弃，完全不显示。
1. 顶点着色器：顶点变换、UV变换、计算世界法线和世界顶点坐标。
2. 片元着色器：获取顶点着色器传入的世界法线和世界顶点坐标，根据UV采样透明度纹理，使用纹理采样结果的A通道值确定是否保留该片元。综合各项信息计算光照。

```glsl
Shader "Unlit/Chapter8-AlphaTest"
{
    Properties
    {
        _MainTex ("Texture", 2D) = "white" {}
        _Color ("Color Tint",Color) = (1,1,1,1)
        _Cutoff("Alpha Cutoff",Range(0,1)) = 0.5
    }
    SubShader
    {
        Tags { "RenderType"="TransparentCutout" "Queue" = "AlphaTest" "IgnoreProjector" = "True" }//透明度测试的三个标签

        Pass
        {
            Tags {"LightMode" = "ForwardBase"}//必须声明前向渲染模式才能得到一些Unity内置的光照变量
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag

            #include "Lighting.cginc"//必须声明这个头文件以获取灯光的信息

            sampler2D _MainTex;
            float4 _MainTex_ST;
            fixed4 _Color;
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
                o.worldNormal = UnityObjectToWorldNormal(v.normal);//注意这两个变换法线和变换坐标的方法
                o.worldPos = mul(unity_ObjectToWorld,v.vertex).xyz;
                return o;
            }

            fixed4 frag (v2f i) : SV_Target
            {
                float3 worldNormal=normalize(i.worldNormal);
                float3 worldLightDir = normalize(UnityWorldSpaceLightDir(i.worldPos));//注意这个获取世界坐标系下光的方向的方法
                fixed4 texColor=tex2D(_MainTex,i.uv);
                fixed3 albedo=texColor.rgb*_Color.rgb;
                clip(texColor.a-_Cutoff);//进行透明度测试的核心操作
                fixed3 ambient=UNITY_LIGHTMODEL_AMBIENT.xyz*albedo;
                fixed3 diffuse=_LightColor0.rgb*albedo*saturate(dot(worldNormal,worldLightDir));
                return fixed4(ambient+diffuse,1.0);
            }
            ENDCG
        }
    }
}
```
[![](https://temp.aoki.dpdns.org/temp/1511731a974f885e75f3ec3ab9b188c2.png)](https://temp.aoki.dpdns.org/temp/1511731a974f885e75f3ec3ab9b188c2.png)

## 透明度混合
将当前片元的透明度作为混合因子，与已经存储在颜色缓冲中的颜色值进行混合（使用混合命令完成）
1. 顶点着色器：顶点变换、UV变换、计算世界法线和世界顶点坐标。
2. 片元着色器：接收顶点着色器的世界法线和世界顶点坐标，使用UV采样透明度纹理，使用采样结果的颜色值计算光照，使用采样结果的透明度值作为片元的透明度值。GPU 按 Blend 指令自动叠色。

```glsl
Shader "Unlit/Chapter8-AlphaTest"
{
    Properties
    {
        _MainTex ("Texture", 2D) = "white" {}
        _Color ("Color Tint",Color) = (1,1,1,1)
        _AlphaScale ("Alpha Scale",range(0,1)) = 0.5//控制透明度混合的程度
    }
    SubShader
    {
        Tags { "RenderType"="Transparent" "Queue" = "Transparent" "IgnoreProjector" = "True" }//透明度混合的三个标签

        Pass
        {
            Tags {"LightMode" = "ForwardBase"}
            ZWrite Off//记得关闭深度写入
            Blend SrcAlpha OneMinusSrcAlpha//声明混合模式，没有这一行BLEND命令，即使代码写正确，也不会看到混合效果。因为默认情况下是BLEND OFF即没有混合，新片元颜色值会覆盖旧片元颜色值，效果就是完全不透明。
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag

            #include "Lighting.cginc"

            sampler2D _MainTex;
            float4 _MainTex_ST;
            fixed4 _Color;
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
            };

            v2f vert (a2v v)
            {
                v2f o;
                o.pos = UnityObjectToClipPos(v.vertex);
                o.uv = TRANSFORM_TEX(v.texcoord, _MainTex);
                o.worldNormal = UnityObjectToWorldNormal(v.normal);
                o.worldPos = mul(unity_ObjectToWorld,v.vertex).xyz;
                return o;
            }

            fixed4 frag (v2f i) : SV_Target
            {
                float3 worldNormal=normalize(i.worldNormal);
                float3 worldLightDir = normalize(UnityWorldSpaceLightDir(i.worldPos));
                fixed4 texColor=tex2D(_MainTex,i.uv);
                fixed3 albedo=texColor.rgb*_Color.rgb;
                fixed3 ambient=UNITY_LIGHTMODEL_AMBIENT.xyz*albedo;
                fixed3 diffuse=_LightColor0.rgb*albedo*saturate(dot(worldNormal,worldLightDir));
                return fixed4(ambient+diffuse,texColor.a*_AlphaScale);//片元着色器只输出带透明度值的片元颜色值即可，GPU自动读取并进行混合操作
            }
            ENDCG
        }
    }
}
```
![](https://temp.aoki.dpdns.org/temp/acd97fbf0cb72bada8774de58433d54c.png)

## 开启深度写入的半透明效果
解决模型跨度大、相互遮挡、自遮挡时逐物体的深度排序失效，且不想进行模型分割。分两步渲染，第一步只写入深度，记录整个场景中半透明物体的深度情况；第二步正常渲染半透明颜色。由于第一步已经得到了正确的、完整的逐像素的深度信息，所以这一步的颜色渲染的结果也是正确的。
```glsl
Shader "Unlit/Chapter8-AlphaTest"
{
    Properties
    {
        _MainTex ("Texture", 2D) = "white" {}
        _Color ("Color Tint",Color) = (1,1,1,1)
        _AlphaScale ("Alpha Scale",range(0,1)) = 0.5
    }
    SubShader
    {
        Tags { "RenderType"="Transparent" "Queue" = "Transparent" "IgnoreProjector" = "True" }//透明度测试的三个标签

        Pass{
            Zwrite On//写入深度缓冲
            ColorMask 0//不输出任何颜色
        }

        Pass
        {
            Tags {"LightMode" = "ForwardBase"}
            ZWrite Off
            Blend SrcAlpha OneMinusSrcAlpha
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag

            #include "Lighting.cginc"

            sampler2D _MainTex;
            float4 _MainTex_ST;
            fixed4 _Color;
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
            };

            v2f vert (a2v v)
            {
                v2f o;
                o.pos = UnityObjectToClipPos(v.vertex);
                o.uv = TRANSFORM_TEX(v.texcoord, _MainTex);
                o.worldNormal = UnityObjectToWorldNormal(v.normal);
                o.worldPos = mul(unity_ObjectToWorld,v.vertex).xyz;
                return o;
            }

            fixed4 frag (v2f i) : SV_Target
            {
                float3 worldNormal=normalize(i.worldNormal);
                float3 worldLightDir = normalize(UnityWorldSpaceLightDir(i.worldPos));
                fixed4 texColor=tex2D(_MainTex,i.uv);
                fixed3 albedo=texColor.rgb*_Color.rgb;
                fixed3 ambient=UNITY_LIGHTMODEL_AMBIENT.xyz*albedo;
                fixed3 diffuse=_LightColor0.rgb*albedo*saturate(dot(worldNormal,worldLightDir));
                return fixed4(ambient+diffuse,texColor.a*_AlphaScale);
            }
            ENDCG
        }
    }
}
```

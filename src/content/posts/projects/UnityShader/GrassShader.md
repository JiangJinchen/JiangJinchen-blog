---
title: 草地着色器
published: 2026-06-29
description: '基于 DX11 几何着色器 + 曲面细分实现程序化草地'
image: ''
tags: [Unity,Shader]
category: '实践项目/UnityShader'
draft: false 
lang: 'zh'
---
# 原文参考
Roystan Grass Shader 官方教程：https://roystan.net/articles/grass-shader
基本操作流程基于该教程扩展，适配DX11 SM4.6管线，实现动态生成、风吹动画、双面光照、完整投射/接收阴影全套功能。
<video width="100%" controls>
  <source src="/videos/grassShader.mp4" type="video/mp4">
  Your browser does not support the video tag.
</video>
# 一、整体技术方案
## 1. 渲染管线执行顺序
VS顶点着色器 → Hull外壳着色器 → Domain域着色器（曲面细分）→ GS几何着色器 → 光栅化 → PS片元着色器
1. **曲面细分**：动态细分地面网格，控制草地密度，无需手动加密模型；
2. **几何着色器核心**：每一个细分顶点生成多段三角条带，构造弧形草叶；
3. **切线空间变换**：适配平面、球体任意曲面，草沿法线向外生长；
4. **随机化系统**：每株草独立朝向、高度、宽度、倒伏角度，避免重复；
5. **风场扰动**：基于世界XZ坐标滚动噪声贴图，全局连贯风吹摆动；
6. **双Pass阴影系统**：ShadowCaster投射阴影 + ForwardBase接收阴影，解决自阴影痤疮、阴影锯齿；
7. **双面光照**：VFACE翻转法线，薄片两面正常漫反射+半透光；
8. **环境光照**：ShadeSH9球谐环境光，阴影区域不发黑。

## 2. 前置硬件要求
- `#pragma target 4.6`：开启完整DX11管线，支持HS/DS细分、GS几何着色器；
- 仅支持PC/高端主机，移动端不支持几何着色器+曲面细分组合；
- 渲染队列`Opaque`，双面渲染`Cull Off`适配薄草面片。

# 二、分步开发
## 阶段1：几何着色器基础——从网格顶点生成草面片
### 1.1 踩坑1：直接输出屏幕空间面片
```hlsl
// VS直接执行MVP变换
return UnityObjectToClipPos(v);
// GS硬编码固定裁剪坐标
o.pos = float4(0.5,0,0,1);
```
**现象**：三角形固定贴屏幕，无透视、不跟随地面移动；
**根源**：顶点变换时机错误，MVP必须在GS构造完草叶局部坐标后统一执行。

### 1.2 踩坑2：固定局部坐标，所有草重叠
```hlsl
// VS只返回原始模型坐标，不在VS做MVP
return v.vertex;
// GS草坐标写死，不叠加草根位置
o.pos = UnityObjectToClipPos(float4(0.5,0,1));
```
**现象**：地面所有顶点生成完全重叠的草，只能看见一株；
**修复**：所有草顶点基于当前细分顶点`IN[0].vertex`做偏移，每株草根部绑定网格点。
![BQACAgUAAyEGAASHRsPbAAEWaJ9qRI-ltOm05BEP3aQ-AAG5lnJPtmAAAnIoAAIDcClWoyzXMILfmoo8BA.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWaJ9qRI-ltOm05BEP3aQ-AAG5lnJPtmAAAnIoAAIDcClWoyzXMILfmoo8BA.png)
### 1.3 踩坑3：固定Y向上，球体曲面草生长错乱
平面模型Y=向上正常，但球体每个顶点法线四面八方，硬编码Y轴向上会导致草垂直模型本地Y，不沿曲面凸起。
![BQACAgUAAyEGAASHRsPbAAEWaKNqRI_FKwm1ObhjG6XjrIsVD5PhaQACdygAAgNwKVYgwnZsQ9QDQjwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWaKNqRI_FKwm1ObhjG6XjrIsVD5PhaQACdygAAgNwKVYgwnZsQ9QDQjwE.png)
**解决方案：切线空间TBN矩阵**
1. 从细分顶点读取`normal、tangent`，叉乘计算副法线binormal；
2. 构造`tangentToLocal`变换矩阵：在切线空间定义标准草叶，再整体旋转到曲面朝向；
3. 切线空间约定：
   - X：草左右宽度
   - Y：草前后倒伏方向
   - Z：曲面法线向上（草生长轴）

```hlsl
float3 vNormal = IN[0].normal;
float4 vTangent = IN[0].tangent;
float3 vBinormal = cross(vNormal, vTangent) * vTangent.w;
float3x3 tangentToLocal = float3x3(
	vTangent.x, vBinormal.x, vNormal.x,
	vTangent.y, vBinormal.y,
	vTangent.z, vBinormal.z, vNormal.z
);
```
![BQACAgUAAyEGAASHRsPbAAEWaKhqRI_xv930HYJbmi6EvJwfCbDhfgACfigAAgNwKVbN03RKowHB1TwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWaKhqRI_xv930HYJbmi6EvJwfCbDhfgACfigAAgNwKVbN03RKowHB1TwE.png)
## 阶段2：草叶多样化随机系统
### 2.1 三维伪随机rand函数
基于经典sin-frac噪声，使用不同分量swizzle更换种子，避免多个随机值强绑定：
```hlsl
float rand(float3 co)
{
	return frac(sin(dot(co.xyz, float3(12.9898, 78.233, 53.539))) * 43758.5453);
}
```
- `rand(pos)`：草自身绕法线旋转朝向；
- `rand(pos.zzx)`：草随机倒伏角度；
- `rand(pos.zyx/xzy)`：随机高度、宽度。

### 2.2 三维旋转矩阵AngleAxis3x3
罗德里格斯旋转公式实现任意轴旋转，用于朝向、倒伏、风扰动：
```hlsl
float3x3 AngleAxis3x3(float angle, float3 axis)
{
	float c, s;
	sincos(angle, s, c);
	float t = 1 - c;
	float x = axis.x, y = axis.y, z = axis.z;
	return float3x3(
		t*x*x + c, t*x*y - s*z, t*x*z + s*y,
		t*x*y + s*z, t*y*y + c, t*y*z - s*x,
		t*x*z - s*y, t*y*z + s*x, t*z*z + c
	);
}
```

### 2.3 三层旋转矩阵叠加（矩阵乘法顺序从右至左）
1. **facingRotationMatrix**：绕Z(法线)随机旋转0~360°，每株草朝向不同；
![BQACAgUAAyEGAASHRsPbAAEWaK5qRJAtfF9KXDBJEv5xiHHJhl9vxgAChCgAAgNwKVYriGaqV1nHHTwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWaK5qRJAtfF9KXDBJEv5xiHHJhl9vxgAChCgAAgNwKVYriGaqV1nHHTwE.png)
2. **bendRotationMatrix**：绕-X轴0~90°向前倒伏；
   > 绕-X而非+X：旋转区间0~90°仅向前弯，不会向后弯折；如需双向改为`(rand-0.5)*PI`；
![BQACAgUAAyEGAASHRsPbAAEWaLNqRJBUdHFeaYl1SjD9rzDUsqUeYwACiSgAAgNwKVbJVyablYyIBTwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWaLNqRJBUdHFeaYl1SjD9rzDUsqUeYwACiSgAAgNwKVbJVyablYyIBTwE.png)
3. **windRotation**：风场动态旋转，实时摆动。

```hlsl
float3x3 transformationMatrix = mul(mul(mul(tangentToLocal,windRotation),facingRotationMatrix),bendRotationMatrix);
// 底部专用矩阵：无风、无倒伏，草根固定不飘
float3x3 transformationMatrixFacing = mul(tangentToLocal,facingRotationMatrix);
```

### 2.4 随机宽高
```hlsl
float height = (rand(pos.zyx)*2-1)*_BladeHeightRandom + _BladeHeight;
float width = (rand(pos.xzy)*2-1)*_BladeWidthRandom + _BladeWidth;
```
`rand()*2-1`将0~1映射为-1~1，实现上下浮动随机。
![BQACAgUAAyEGAASHRsPbAAEWaLlqRJB1wD6j2QLmGogfHraM2SVlKgACjygAAgNwKVZA_3xt2t37hTwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWaLlqRJB1wD6j2QLmGogfHraM2SVlKgACjygAAgNwKVZA_3xt2t37hTwE.png)
![BQACAgUAAyEGAASHRsPbAAEWaL5qRJCeah0Gt6SknsekiveBbQ_OjgAClSgAAgNwKVYTpUDUBcwOvTwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWaL5qRJCeah0Gt6SknsekiveBbQ_OjgAClSgAAgNwKVYTpUDUBcwOvTwE.png)
## 阶段3：多段弧形草叶
单三角形草僵硬，分段构造三角条带实现自然弯曲：
1. 宏定义`#define BLADE_SEGMENTS 3`分段数量；
2. `[maxvertexcount(BLADE_SEGMENTS*2+1)]`声明最大输出顶点；
3. 循环每层输出左右两点，最后追加顶部尖端；
![BQACAgUAAyEGAASHRsPbAAEWaM1qRJIK3LkufMX_0ego1dkrP7r_BwACpygAAgNwKVadnQTxTIoM7DwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWaM1qRJIK3LkufMX_0ego1dkrP7r_BwACpygAAgNwKVadnQTxTIoM7DwE.png)
4. `pow(t,_BladeCurve)`非线性弯曲：底部弯曲极小，草尖弯曲幅度大。
![BQACAgUAAyEGAASHRsPbAAEWaM9qRJJJB8hlXO0-q1k6xcO-alWRGwACqigAAgNwKVbn3H6r9ZXOuDwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWaM9qRJJJB8hlXO0-q1k6xcO-alWRGwACqigAAgNwKVbn3H6r9ZXOuDwE.png)
```hlsl
float t = i/(float)BLADE_SEGMENTS;
float segmentHeight = height*t;
float segmentWidth = width*(1-t);
float segmentForward = pow(t,_BladeCurve)*forward;
// 底部i=0使用固定矩阵，草根不动
float3x3 transformMatrix = i==0 ? transformationMatrixFacing : transformationMatrix;
triStream.Append(GenerateGrassVertex(pos,segmentWidth,segmentHeight,segmentForward,float2(0,t),transformMatrix));
triStream.Append(GenerateGrassVertex(pos,-segmentWidth,segmentHeight,segmentForward,float2(1,t),transformMatrix));
```
切线空间顶点：`float3 tangentPoint = float3(width,forward,height)`，forward控制向前拱起弧度。

## 阶段4：曲面细分
### 4.1 细分管线分工
1. **Hull外壳着色器**：设置内外细分等级`_TessellationUniform`，输出面片控制点；
2. **硬件细分器**：根据等级自动插入海量新顶点；
3. **Domain域着色器**：对细分后每个顶点输出位置、法线、切线，送入几何着色器；
### 4.2 实现方式
复用通用细分头文件`CustomTessellation.cginc`，无需手写HS/DS，仅在Pass声明：
```hlsl
#pragma hull hull
#pragma domain domain
```
优势：美术直接滑动参数控制草地疏密，不需要修改网格模型。
![BQACAgUAAyEGAASHRsPbAAEWaMBqRJDMB27LNdmsGb1gl0Cfbl_mTAAClygAAgNwKVYWIkxVT60Y3DwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWaMBqRJDMB27LNdmsGb1gl0Cfbl_mTAAClygAAgNwKVYWIkxVT60Y3DwE.png)
## 阶段5 全局连贯风场扰动
### 5.1 关键设计：不用模型UV，改用世界XZ坐标采样
- 模型UV仅单块0~1区间，多块草地风会割裂；
- 世界坐标连续平铺噪声，整片草原同步摆动；
- `_Time.y`滚动贴图，模拟持续流动风向。
```hlsl
float2 uv = pos.xz * _WindDistortionMap_ST.xy + _WindDistortionMap_ST.zw + _WindFrequency*_Time.y;
// 贴图0~1转-1~1正负扰动
float2 windSample = (tex2Dlod(_WindDistortionMap,float4(uv,0,0)).xy*2-1)*_WindStrength;
float3 wind = normalize(float3(windSample.x,windSample.y,0));
float3x3 windRotation = AngleAxis3x3(UNITY_PI*windSample,wind);
```
> GS禁止普通tex2，必须使用带mip的`tex2Dlod`。
![BQACAgUAAyEGAASHRsPbAAEWaMJqRJDdOaJ8rTLv9OgavX8ce3CK-AACmSgAAgNwKVY7Kyh_GnLH9DwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWaMJqRJDdOaJ8rTLv9OgavX8ce3CK-AACmSgAAgNwKVY7Kyh_GnLH9DwE.png)
### 5.2 草根固定优化
底部两段顶点不叠加风、倒伏矩阵，仅保留自身旋转，根部牢牢贴地面，不会随风飘离地形。

## 阶段6 法线生成 + 双面光照系统
### 6.1 切线空间法线逻辑
```hlsl
// 平直草：无弯曲forward=0
float3 tangentNormal = float3(0,-1,0);
// 弯曲草：法线随拱起向上偏移Z
float3 tangentNormal = normalize(float3(0,-1,forward));
```

### 6.2 空间转换规范
几何阶段输出模型空间法线，在`VertexOutput`转为世界空间：
```hlsl
o.normal = UnityObjectToWorldNormal(normal);
```
光照`_WorldSpaceLightPos0`为世界空间向量，必须统一坐标系才能正确NdotL。

### 6.3 VFACE语义说明
`fixed facing : VFACE`由光栅器自动赋值：
- 逆时针三角正面：`1`；
- 顺时针背面：`-1`；
配合`Cull Off`双面渲染，解决薄面片背面无光问题。

## 阶段7 阴影
### 7.1 ShadowCaster投射通道
#### 核心问题：GS动态生成草，默认阴影通道不会执行几何着色器，无草深度，无法投射阴影
解决：单独ShadowCaster Pass，完全复用同一套HS/DS/GS代码，完整重建草几何写入ShadowMap。
```hlsl
Pass{
	Tags{"LightMode" = "ShadowCaster"}
	CGPROGRAM
	#pragma vertex vert
	#pragma geometry geo
	#pragma hull hull
	#pragma domain domain
	#pragma target 4.6
	#pragma multi_compile_shadowcaster
	float4 frag(geometryOutput i):SV_Target{
		SHADOW_CASTER_FRAGMENT(i);
	}
	ENDCG
}
```
![BQACAgUAAyEGAASHRsPbAAEWaNFqRJJ_RtxcUtJCtJEDWYmEZBkuyAACrCgAAgNwKVZT9J2DPgcCczwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWaNFqRJJ_RtxcUtJCtJEDWYmEZBkuyAACrCgAAgNwKVZT9J2DPgcCczwE.png)
#### shadow acne解决
薄面片深度值几乎与ShadowMap存储深度重合，浮点精度误差造成自遮挡黑斑。
![BQACAgUAAyEGAASHRsPbAAEWaNNqRJK-ywKahR7CmW2M6J5xNQWonQACrygAAgNwKVZEQDW9vCcQNTwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWaNNqRJK-ywKahR7CmW2M6J5xNQWonQACrygAAgNwKVZEQDW9vCcQNTwE.png)
仅在阴影通道对裁剪空间顶点偏移：
```hlsl
#if UNITY_PASS_SHADOWCASTER
	o.pos = UnityApplyLinearShadowBias(o.pos);
#endif
```
- 仅修改阴影几何体，Forward画面模型坐标不变；
- 内置斜率自适应偏移，斜面偏移更大，平面偏移小，避免Peter Panning（影子飘离物体）。
![BQACAgUAAyEGAASHRsPbAAEWaNZqRJLSev7jou937HVIJYDKhoNv1gACsigAAgNwKVYy8ZE4fTIqljwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWaNZqRJLSev7jou937HVIJYDKhoNv1gACsigAAgNwKVYy8ZE4fTIqljwE.png)
### 7.2 ForwardBase接收阴影通道
#### 1. 阴影坐标传递
放弃`SHADOW_COORDS`宏（CGINCLUDE全局结构体造成ShadowCaster编译报错），手动定义`unityShadowCoord4 _ShadowCoord`：
```hlsl
struct geometryOutput{
	float4 pos : SV_POSITION;
	float2 uv : TEXCOORD0;
	float3 normal : NORMAL;
	unityShadowCoord4 _ShadowCoord:TEXCOORD1;
};
geometryOutput VertexOutput(xxx){
	o._ShadowCoord = ComputeScreenPos(o.pos);
}
```
**命名固定为_ShadowCoord原因**：内置宏`SHADOW_ATTENUATION(i)`硬编码读取`i._ShadowCoord`，无法自定义变量名。

#### 2. 阴影采样与变体支持
```hlsl
#pragma multi_compile_fwdbase // 开启屏幕阴影、级联阴影变体
float shadow = SHADOW_ATTENUATION(i);
```
![BQACAgUAAyEGAASHRsPbAAEWaNJqRJKe79K1gAU8jtDv0XXB7pUEJgACrigAAgNwKVamrb1cyXZM2DwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWaNJqRJKe79K1gAU8jtDv0XXB7pUEJgACrigAAgNwKVamrb1cyXZM2DwE.png)
### 7.3 叶片边缘锯齿成因与优化
- MSAA多重抗锯齿仅作用颜色缓冲区，**阴影贴图无MSAA**；
- 画面平滑像素采样硬边界阴影，出现毛刺；
![BQACAgUAAyEGAASHRsPbAAEWaNdqRJMGvHVfIyfjync1crkY7jPYngACsygAAgNwKVYjLIHyTWj0ZTwE.png](https://img.remit.ee/api/file/BQACAgUAAyEGAASHRsPbAAEWaNdqRJMGvHVfIyfjync1crkY7jPYngACsygAAgNwKVYjLIHyTWj0ZTwE.png)
优化方案：
1. 后处理TAA/FXAA全局柔化边缘；
2. 阴影采样PCF多纹素滤波软化边界。

## 阶段8 片元光照合成完整逻辑
```hlsl
float shadow=SHADOW_ATTENUATION(i);
// 双面朝外法线
float3 normal=facing>0?i.normal:-i.normal;
// 漫反射+半透光补偿，逆光不会死黑
float NdotL=saturate(saturate(dot(normal,_WorldSpaceLightPos0))+_TranslucentGain)*shadow;
// ShadeSH9二阶球谐环境光，给阴影区域补底色
float3 ambient=ShadeSH9(float4(normal,1));
float4 lightIntensity=NdotL*_LightColor0+float4(ambient,1);
// uv.y插值：草根不受光照，草尖受光明暗变化
float4 col=lerp(_BottomColor,_TopColor*lightIntensity,i.uv.y);
```
1. `ShadeSH9`：内置9项二阶球谐求值，输入归一化世界法线，预积分漫反射，无需手动max(dot,0)；
2. `lerp(_BottomColor,_TopColor*lightIntensity,i.uv.y)`设计：草根深埋草丛几乎无直射光，仅保留底色；草尖暴露完全受光照影响。

# 三、Shader代码结构
1. **Properties**：美术可调参数（颜色、尺寸、随机、风、细分、透光）；
2. **CGINCLUDE全局公共代码块**：
   - 随机rand、旋转AngleAxis3x3工具函数；
   - 结构体vertexInput/vertexOutput（细分头文件导入）；
   - geometryOutput GS输出结构体（位置、UV、法线、阴影坐标）；
   - VertexOutput：坐标MVP、法线转世界、阴影坐标计算、阴影Bias条件偏移；
   - GenerateGrassVertex：切线空间草顶点构造、法线同步变换；
   - geo几何着色器主逻辑（TBN、多层旋转、风场、分段草输出）；
3. SubShader双Pass：
   - Pass1 ForwardBase：主渲染、接收阴影、完整光照；
   - Pass2 ShadowCaster：投射阴影、深度Bias修正；
4. 关键编译指令汇总
```hlsl
#pragma target 4.6 // DX11完整管线
#pragma hull hull
#pragma domain domain
#pragma geometry geo
#pragma multi_compile_fwdbase // 正向阴影变体
#pragma multi_compile_shadowcaster // 投射阴影变体
```

## 五、扩展优化方向（生产级改进）
1. **距离剔除LOD**：远距离关闭细分、减少草分段，降低GPU开销；
2. **草实例化**：C#预生成草根点，减少网格面数；
3. **PBR扩展**：添加高光、次表面散射替代简易_TranslucentGain；
4. **交互草地**：传入踩踏纹理，局部修改草旋转矩阵实现倒伏；
5. **级联阴影优化**：调整阴影贴图分辨率，远距离降低采样精度；
6. **移动端兼容**：移除GS/Tess，改用面片贴图模拟草地。

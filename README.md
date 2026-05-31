# 影视网站项目

## 项目结构

本项目包含两个子项目：

- **ckweb**: 前端项目（Vue.js）
- **ckapi**: 后端项目（.NET Core）

## 技术栈

### 前端 (ckweb)
- Vue.js 3.5+
- Vue Router 4.6+
- Pinia 3.0+
- Axios
- Vite 7.1+

### 后端 (ckapi)
- .NET Core 8.0
- SQLite 数据库
- Swagger API 文档

## 数据库表结构

### 1. Video (影片表)
- id: 主键
- code: 番号
- name: 名称
- country: 所属国家
- hosturl: 主机地址
- videosize: 视频大小（字节）
- quality: 视频质量标记（如：4K, 1080P, 720P等）
- seriesid: 所属系列ID
- sortorder: 排序序号
- cover: 封面图片（Base64）
- description: 简介
- ctime: 创建时间
- utime: 修改时间

### 2. VideoSeries (影视系列表)
- id: 主键
- name: 名称
- alias: 别名
- link: 链接
- country: 所属国家
- description: 描述
- ctime: 创建时间
- utime: 修改时间

### 3. Actor (演员表)
- id: 主键
- name: 姓名
- alias: 别名
- country: 所属国家
- avatar: 头像（Base64）
- description: 简介
- ctime: 创建时间
- utime: 修改时间

### 4. VideoActor (视频-演员关联表)
- id: 主键
- videoid: 视频ID
- actorid: 演员ID
- ctime: 创建时间
- utime: 修改时间

### 5. Highlight (精彩集锦表)
- id: 主键
- image: 图片（Base64）
- actorid: 对应演员ID
- videoid: 对应影片ID
- title: 标题
- description: 描述
- ctime: 创建时间
- utime: 修改时间

### 6. LikeRecord (点赞记录表)
- id: 主键
- videoid: 视频ID
- liketime: 点赞时间
- usertoken: 用户标识
- ctime: 创建时间
- utime: 修改时间

### 7. SystemSetting (系统设置表)
- id: 主键
- name: 设置名称
- content: 设置内容
- ctime: 创建时间
- utime: 修改时间

### 8. FriendLink (友情链接表)
- id: 主键
- name: 网站名称
- link: 网站链接
- logo: Logo（Base64或URL）
- description: 描述
- sortorder: 排序序号
- ctime: 创建时间
- utime: 修改时间

## 快速开始

### 后端启动

```bash
cd ckapi
dotnet restore
dotnet run
```

后端将运行在 http://localhost:5033
Swagger 文档地址: http://localhost:5033/swagger

### 前端启动

```bash
cd ckweb
npm install
npm run dev
```

前端将运行在 http://localhost:3001

## 前端模块

1. **首页**: 今日推荐、最新上映、最受喜爱
2. **影片类型**: 按系列、国家筛选影片
3. **演员列表**: 演员信息展示
4. **影视系列**: 系列分类展示
5. **精彩集锦**: 精彩截图集锦
6. **友情链接**: 页脚友情链接

## API 接口

### 视频相关
- GET /api/video - 获取视频列表（支持分页、筛选）
- GET /api/video/{id} - 获取视频详情
- GET /api/video/recommend - 获取今日推荐
- GET /api/video/latest - 获取最新上映
- GET /api/video/most-liked - 获取最多点赞
- POST /api/video - 添加视频
- PUT /api/video/{id} - 更新视频
- DELETE /api/video/{id} - 删除视频

### 演员相关
- GET /api/actor - 获取演员列表
- GET /api/actor/{id} - 获取演员详情
- GET /api/actor/{id}/videos - 获取演员的影片
- POST /api/actor - 添加演员
- PUT /api/actor/{id} - 更新演员
- DELETE /api/actor/{id} - 删除演员

### 系列相关
- GET /api/series - 获取系列列表
- GET /api/series/{id} - 获取系列详情
- GET /api/series/{id}/videos - 获取系列下的影片
- POST /api/series - 添加系列
- PUT /api/series/{id} - 更新系列
- DELETE /api/series/{id} - 删除系列

### 点赞相关
- POST /api/like/{videoId} - 点赞视频
- DELETE /api/like/{videoId} - 取消点赞
- GET /api/like/count/{videoId} - 获取点赞数
- GET /api/like/check/{videoId} - 检查是否已点赞

## 开发说明

- 数据库文件: ckweb.db（首次运行自动创建）
- 后端端口: 5033
- 前端端口: 3001
- API 代理: 前端通过 /api 代理到后端

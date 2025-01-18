<p align="center"> 
<a href="https://git.io/typing-svg"><img src="https://readme-typing-svg.demolab.com?font=Fira+Code&pause=1000&center=true&width=435&lines=INFINITY+WHATSAPP+BOT;CREATED+BY+SADARU" alt="Typing SVG" /></a>
</p>
<p align="center">
</a>
<a href="https://github.com/SadarulkOfficial/Infinity-WhatsApp-Bot-V1/fork">
<img src="https://img.shields.io/github/forks/SadarulkOfficial/Infinity-WhatsApp-Bot-V1?label=Fork&style=social">
</a>
<a href="https://github.com/SadarulkOfficial/Infinity-WhatsApp-Bot-V1">
<img src="https://img.shields.io/github/stars/SadarulkOfficial/Infinity-WhatsApp-Bot-V1?style=social">
</a>
</p>
<p align="center">
<img src="https://img.shields.io/github/repo-size/SadarulkOfficial/Infinity-WhatsApp-Bot-V1?color=blue&label=Repo%20Size&style=plastic">
<img src="https://img.shields.io/github/license/SadarulkOfficial/Infinity-WhatsApp-Bot-V1?color=blue&label=License&style=plastic">
<img src="https://img.shields.io/github/languages/top/SadarulkOfficial/Infinity-WhatsApp-Bot-V1?color=blue&label=Javascript&style=plastic">
<img src="https://img.shields.io/static/v1?label=Author&message=Sadaru&color=blue&style=plastic">
</p>
<img src="https://i.imgur.com/dBaSKWF.gif" height="100" width="100%">
<p align="center">
GET SESSION ID USING PAIR CODE
<p align="center">
<a href='https://weird-murielle-sadarulk9999-79954227.koyeb.app/' target="_blank"><img alt='Get Session ID' src='https://img.shields.io/badge/Click%20here%20to%20get%20your%20session%20id-blue'/></a>
</p>
<br>
<p align="center">
WORKFLOW CODE
</p>

```
name: Node.js CI

on:
  push:
    branches:
      - main
  pull_request:
    branches:
      - main

jobs:
  build:

    runs-on: ubuntu-latest

    strategy:
      matrix:
        node-version: [20.x]

    steps:
    - name: Checkout repository
      uses: actions/checkout@v3

    - name: Set up Node.js
      uses: actions/setup-node@v3
      with:
        node-version: ${{ matrix.node-version }}

    - name: Install dependencies
      run: npm install

    - name: Start application
      run: npm start
```

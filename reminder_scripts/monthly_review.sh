#!/bin/bash

# 月度复盘提醒脚本
# 每月 1 号早上 10 点运行

MONTH=$(date +'%Y年%m月')

# 显示通知
osascript -e "display notification \"📊 $MONTH 到了！记得做一次月度复盘，总结上个月的成果和计划本月的目标。\" with title \"月度复盘提醒\" sound name \"Glass\""

# 可以在这里添加更多提醒，比如打开复盘文档
# open /path/to/your/review/document.md

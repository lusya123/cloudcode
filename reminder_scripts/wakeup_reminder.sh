#!/bin/bash

# 起床提醒脚本
# 每天早上 9 点运行

# 显示通知
osascript -e 'display notification "⏰ 该起床啦！美好的一天开始了！" with title "起床提醒" sound name "Glass"'

# 如果是周三或周五，额外提醒任务
DAY_OF_WEEK=$(date +%u)  # 1=周一, 3=周三, 5=周五

if [ "$DAY_OF_WEEK" -eq 3 ]; then
    osascript -e 'display notification "📅 今天是周三，记得完成本周任务哦！" with title "周三任务提醒" sound name "Glass"'
elif [ "$DAY_OF_WEEK" -eq 5 ]; then
    osascript -e 'display notification "📅 今天是周五，记得完成本周任务并准备周末！" with title "周五任务提醒" sound name "Glass"'
fi

#!/bin/bash

echo "🔧 正在设置定时提醒任务..."

# 创建 LaunchAgents 目录（如果不存在）
mkdir -p ~/Library/LaunchAgents

# 复制 plist 文件到 LaunchAgents
cp /Users/xuehongyu/Downloads/cloudclaude/reminder_scripts/com.cloudclaude.wakeup.plist ~/Library/LaunchAgents/
cp /Users/xuehongyu/Downloads/cloudclaude/reminder_scripts/com.cloudclaude.monthly_review.plist ~/Library/LaunchAgents/

# 加载定时任务
launchctl load ~/Library/LaunchAgents/com.cloudclaude.wakeup.plist
launchctl load ~/Library/LaunchAgents/com.cloudclaude.monthly_review.plist

echo "✅ 定时提醒任务设置完成！"
echo ""
echo "📋 已设置的任务："
echo "  ⏰ 每天早上 9:00 - 起床提醒（周三/周五会额外提醒任务）"
echo "  📊 每月 1 号早上 10:00 - 月度复盘提醒"
echo ""
echo "📝 日志文件位置："
echo "  - /tmp/wakeup_reminder.log"
echo "  - /tmp/monthly_review_reminder.log"
echo ""
echo "💡 测试提醒："
echo "  运行 'bash /Users/xuehongyu/Downloads/cloudclaude/reminder_scripts/wakeup_reminder.sh' 可以立即测试起床提醒"
echo "  运行 'bash /Users/xuehongyu/Downloads/cloudclaude/reminder_scripts/monthly_review.sh' 可以立即测试月度复盘提醒"
echo ""
echo "❌ 如需取消任务："
echo "  launchctl unload ~/Library/LaunchAgents/com.cloudclaude.wakeup.plist"
echo "  launchctl unload ~/Library/LaunchAgents/com.cloudclaude.monthly_review.plist"

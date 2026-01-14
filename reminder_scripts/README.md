# 定时提醒任务使用说明

## 📋 已设置的提醒任务

### 1. 每日起床提醒
- **时间**：每天早上 9:00
- **内容**：起床提醒
- **特殊提醒**：
  - 周三：会额外提醒"今天是周三，记得完成本周任务哦！"
  - 周五：会额外提醒"今天是周五，记得完成本周任务并准备周末！"

### 2. 月度复盘提醒
- **时间**：每月 1 号早上 10:00
- **内容**：提醒你做月度复盘，总结上个月并规划本月

---

## 🧪 测试提醒

如果你想立即测试提醒效果，可以运行：

```bash
# 测试起床提醒
bash /Users/xuehongyu/Downloads/cloudclaude/reminder_scripts/wakeup_reminder.sh

# 测试月度复盘提醒
bash /Users/xuehongyu/Downloads/cloudclaude/reminder_scripts/monthly_review.sh
```

---

## 🛠 管理定时任务

### 查看当前运行的任务
```bash
launchctl list | grep cloudclaude
```

### 停用定时任务
```bash
launchctl unload ~/Library/LaunchAgents/com.cloudclaude.wakeup.plist
launchctl unload ~/Library/LaunchAgents/com.cloudclaude.monthly_review.plist
```

### 重新启用定时任务
```bash
launchctl load ~/Library/LaunchAgents/com.cloudclaude.wakeup.plist
launchctl load ~/Library/LaunchAgents/com.cloudclaude.monthly_review.plist
```

### 完全删除定时任务
```bash
# 先卸载
launchctl unload ~/Library/LaunchAgents/com.cloudclaude.wakeup.plist
launchctl unload ~/Library/LaunchAgents/com.cloudclaude.monthly_review.plist

# 删除文件
rm ~/Library/LaunchAgents/com.cloudclaude.wakeup.plist
rm ~/Library/LaunchAgents/com.cloudclaude.monthly_review.plist
```

---

## 📝 日志文件

如果提醒没有正常工作，可以查看日志：

```bash
# 查看起床提醒日志
cat /tmp/wakeup_reminder.log

# 查看月度复盘日志
cat /tmp/monthly_review_reminder.log

# 查看错误日志
cat /tmp/wakeup_reminder.err
cat /tmp/monthly_review_reminder.err
```

---

## 📁 文件位置

所有文件都在：`/Users/xuehongyu/Downloads/cloudclaude/reminder_scripts/`

- `wakeup_reminder.sh` - 起床提醒脚本
- `monthly_review.sh` - 月度复盘提醒脚本
- `com.cloudclaude.wakeup.plist` - 起床提醒定时任务配置
- `com.cloudclaude.monthly_review.plist` - 月度复盘提醒定时任务配置
- `setup_reminders.sh` - 安装脚本

---

## 💡 注意事项

1. 确保你的电脑在设定的时间是开机状态
2. macOS 可能会首次运行时要求授予通知权限，请点击"允许"
3. 如果提醒没有出现，检查"系统偏好设置 > 通知 > 脚本编辑器"是否允许通知

# Claude Code Arabic Fix (VS Code) — إصلاح العربي لإضافة Claude Code

**English:** Fixes Arabic/RTL text rendering inside the Claude Code extension chat panel in Visual Studio Code — automatic RTL direction, right alignment, proper list markers, and auto-direction while typing, while keeping code blocks LTR. Works on Windows, macOS, and Linux. Inspired by the [Claude Arabic Fix](https://chromewebstore.google.com/detail/claude-arabic-fix/fbigmifidpomomfafkacnefbaingljok) Chrome extension for Claude.ai.

---

يصلّح اتجاه النص العربي (RTL) والمحاذاة والقوائم داخل نافذة محادثة Claude Code في Visual Studio Code — نفس فكرة إضافة "Claude Arabic Fix" لمتصفح كروم.

## المتطلبات
- VS Code مثبت فيه إضافة **Claude Code** (من Anthropic)
- يدعم Windows و macOS و Linux

## طريقة التركيب — Windows

1. فك الضغط عن المجلد في أي مكان (مثلاً سطح المكتب)
2. افتح المجلد، واضغط بزر الفأرة الأيمن على ملف `install.ps1` واختر **Run with PowerShell**

   أو افتح PowerShell داخل المجلد ونفّذ:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\install.ps1
   ```
3. إذا ظهرت رسالة `Done. Reload VS Code...` فالتركيب نجح
4. أغلق VS Code وافتحه من جديد — انتهينا ✅

## طريقة التركيب — macOS / Linux

1. فك الضغط عن المجلد في أي مكان
2. افتح تطبيق **Terminal** واسحب المجلد داخله بعد كتابة `cd ` (مسافة بعدها)، ثم اضغط Enter
3. نفّذ الأمرين:
   ```bash
   chmod +x install.sh
   ./install.sh
   ```
4. إذا ظهرت رسالة `Done...` فالتركيب نجح
5. أغلق VS Code تمامًا (`Cmd+Q` في الماك) وافتحه من جديد — انتهينا ✅

## ملاحظات مهمة

- **بعد كل تحديث لإضافة Claude Code** ينمسح الإصلاح (لأن التحديث يستبدل ملفات الإضافة). الحل: أعد تشغيل السكربت مرة ثانية وأعد فتح VS Code.
- السكربت يأخذ نسخة احتياطية (`.bak`) من الملفات الأصلية قبل التعديل.
- **لإزالة الإصلاح** نهائيًا:
  - Windows: `powershell -ExecutionPolicy Bypass -File .\install.ps1 -Remove`
  - macOS / Linux: `./install.sh --remove`

## وش يسوي بالضبط؟

يضيف كود صغير (JS + CSS) داخل واجهة المحادثة:
- يكتشف النص العربي تلقائيًا ويحوّله RTL مع محاذاة يمين
- القوائم المرقمة والنقطية تصير علاماتها على اليمين
- حقل الكتابة يكتشف الاتجاه تلقائيًا وأنت تكتب
- الأكواد البرمجية تبقى دائمًا LTR حتى داخل النص العربي

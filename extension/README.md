# Claude Code Arabic Fix — إصلاح العربي لإضافة Claude Code

Fixes Arabic/RTL text rendering inside the **Claude Code** extension chat panel in VS Code:

- Auto-detects Arabic and switches paragraphs, lists, and headings to RTL with right alignment
- Numbered and bulleted lists get their markers on the correct side
- The composer auto-detects direction while you type, line by line
- Code blocks always stay LTR, even inside Arabic text
- **Re-applies itself automatically after every Claude Code update** — no manual steps

---

يصلّح عرض النص العربي داخل نافذة محادثة **Claude Code** في VS Code:

- اكتشاف تلقائي للعربي وتحويل الفقرات والقوائم والعناوين إلى RTL بمحاذاة يمين
- علامات القوائم المرقمة والنقطية تظهر في الجهة الصحيحة
- حقل الكتابة يكتشف الاتجاه تلقائيًا أثناء الكتابة
- الأكواد البرمجية تبقى دائمًا LTR حتى داخل النص العربي
- **يعيد تطبيق الإصلاح تلقائيًا بعد كل تحديث لإضافة Claude Code** — بدون أي خطوات يدوية

## Usage — الاستخدام

Just install it. The fix is applied automatically on startup; you'll be prompted to reload the window once.

ركّب الإضافة فقط، والإصلاح يتطبق تلقائيًا عند التشغيل مع طلب إعادة تحميل النافذة مرة واحدة.

Commands (Ctrl+Shift+P):

- `Claude Arabic Fix: Apply / Re-apply` — تطبيق الإصلاح يدويًا
- `Claude Arabic Fix: Remove` — إزالة الإصلاح

## How it works — كيف يعمل

The extension injects a small `dir="auto"`-based script and RTL-aware CSS into the Claude Code webview bundle, with a one-time backup (`.bak`) of the original files. Removing the fix restores the original behavior.

تحقن الإضافة كودًا صغيرًا (JS + CSS) داخل ملفات واجهة Claude Code مع نسخة احتياطية من الملفات الأصلية، والإزالة ترجع الوضع كما كان.

---

Source & issues: https://github.com/Ahmed-EraGroup/claude-code-arabic-fix

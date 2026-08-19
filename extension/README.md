# Claude Code Arabic Fix — إصلاح العربي لإضافة Claude Code

Fixes Arabic & Hebrew (RTL) text rendering **inside the actual Claude Code chat panel** in VS Code — not a mirror, not a side panel, no lag. The real chat you type and read in simply works in RTL.

- **Fixes the real panel in place** — unlike mirror-panel extensions that show a delayed read-only copy of your chat beside the broken original, this fixes the chat itself: zero lag, and tool calls, images, and code all stay in one place
- Auto-detects Arabic/Hebrew and switches paragraphs, lists, headings, quotes, and table cells to RTL with right alignment
- A mostly-Arabic line stays RTL even when it quotes English terms — direction follows the dominant script, not the first word
- Your own messages align to the right, like any proper RTL chat
- **Pick your Arabic font and line height** from VS Code settings, or mirror the whole panel layout to RTL
- The composer auto-detects direction **while you type**, line by line
- Code blocks, diffs and terminal output always stay LTR, even inside Arabic text
- **Re-applies itself automatically after every Claude Code update** — no manual steps
- A status-bar indicator tells you at a glance whether the fix is live, with one-click diagnostics

---

يصلّح عرض النص العربي **داخل نافذة محادثة Claude Code نفسها** — مو لوحة مرآة جانبية فيها نسخة متأخرة من المحادثة، بل النافذة الحقيقية اللي تكتب وتقرأ فيها:

- اكتشاف تلقائي للعربي وتحويل الفقرات والقوائم والعناوين والاقتباسات وخلايا الجداول إلى RTL بمحاذاة يمين
- السطر العربي يبقى RTL حتى لو فيه مصطلحات إنجليزية — الاتجاه يتحدد بالغالب مو بأول كلمة
- رسائلك أنت تنسحب لليمين مثل أي تطبيق محادثة عربي محترم
- **تقدر تختار الخط العربي وارتفاع السطر** من إعدادات VS Code، أو تقلب تخطيط اللوحة كامل إلى RTL
- حقل الكتابة يكتشف الاتجاه تلقائيًا أثناء الكتابة، سطرًا بسطر
- الأكواد والفروقات ومخرجات الطرفية تبقى دائمًا LTR حتى داخل النص العربي
- **يعيد تطبيق الإصلاح تلقائيًا بعد كل تحديث لإضافة Claude Code** — بدون أي خطوات يدوية
- مؤشر في شريط الحالة يبيّن لك هل الإصلاح شغّال، وبضغطة واحدة تفتح شاشة التشخيص

## Usage — الاستخدام

Just install it. The fix is applied automatically on startup; you'll be prompted to reload the window once.

ركّب الإضافة فقط، والإصلاح يتطبق تلقائيًا عند التشغيل مع طلب إعادة تحميل النافذة مرة واحدة.

Commands (Ctrl+Shift+P):

- `Claude Arabic Fix: Apply / Re-apply` — تطبيق الإصلاح يدويًا
- `Claude Arabic Fix: Remove` — إزالة الإصلاح
- `Claude Arabic Fix: Status / Diagnostics` — حالة الإصلاح وأي إصدار من Claude Code مرقّع

## Settings — الإعدادات

| Setting | Default | What it does — الوصف |
| --- | --- | --- |
| `claudeArabicFix.enabled` | `true` | Keep the fix applied; turning it off removes the patch — تفعيل الإصلاح أو إزالته |
| `claudeArabicFix.fontFamily` | *(editor font)* | CSS font stack for Arabic/Hebrew text, e.g. `Cairo, 'Noto Naskh Arabic', Tahoma` — الخط العربي |
| `claudeArabicFix.lineHeight` | `1.7` | Line height for RTL text — ارتفاع السطر للنص العربي |
| `claudeArabicFix.forceRtlLayout` | `false` | Mirror the whole panel layout to RTL, not just the text — قلب تخطيط اللوحة كاملًا |
| `claudeArabicFix.showReloadPrompt` | `true` | Show the reload notification after patching — إشعار إعادة التحميل |
| `claudeArabicFix.showStatusBarItem` | `true` | Show the status-bar indicator — مؤشر شريط الحالة |

Changing any of these re-applies the fix immediately; reload the window to see it.

أي تغيير في الإعدادات يعيد تطبيق الإصلاح فورًا — أعد تحميل النافذة لتشوف النتيجة.

## How it works — كيف يعمل

The extension injects a small `dir`-aware script and RTL stylesheet into the Claude Code webview bundle, with a one-time backup (`.bak`) of the original files. Every installed Claude Code version folder is patched — including one that an auto-update just dropped on disk — so the next reload always starts fixed. Each patch is stamped with the extension version and your settings, so an outdated patch is replaced instead of left in place. Removing the fix restores the original behavior.

تحقن الإضافة كودًا صغيرًا (JS + CSS) داخل ملفات واجهة Claude Code مع نسخة احتياطية من الملفات الأصلية، وترقّع كل إصدارات Claude Code الموجودة على القرص — بما فيها اللي نزل للتو من التحديث التلقائي. كل ترقيع يحمل ختم نسخة الإضافة وإعداداتك، فالترقيع القديم يُستبدل تلقائيًا. والإزالة ترجع الوضع كما كان.

---

Source & issues: https://github.com/Ahmed-EraGroup/claude-code-arabic-fix

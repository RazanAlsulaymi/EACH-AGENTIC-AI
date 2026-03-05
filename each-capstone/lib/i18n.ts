export type Locale = "en" | "ar"

export const translations: Record<Locale, Record<string, string>> = {
  en: {
    // Login
    "login.title": "EACH",
    "login.subtitle": "Sign in to access classes, students, and your workspace.",
    "login.email": "Email",
    "login.password": "Password",
    "login.submit": "Sign in",
    "login.privacy": "Privacy",
    "login.terms": "Terms",
    "login.about": "About",

    // Sidebar
    "sidebar.home": "Home",
    "sidebar.classes": "Classes",
    "sidebar.students": "Students",
    "sidebar.recentChats": "Recent Chats",
    "sidebar.settings": "Settings",
    "sidebar.collapse": "Collapse sidebar",
    "sidebar.expand": "Expand sidebar",
    "sidebar.search": "Search...",

    // Home
    "home.searchPlaceholder": "Search students, classes...",
    "home.subtitle": "Search for a student or class to begin",
    "home.noResults": "No results found for",
    "home.classes": "Classes",
    "home.students": "Students",
    "home.studentsCount": "students",

    // Classes
    "classes.title": "Classes",
    "classes.listView": "List view",
    "classes.gridView": "Grid view",

    // Students
    "students.title": "Students",

    // Chat
    "chat.welcomeStudent": "Hello! I'm ready to help you with {name}'s learning plan. What would you like to discuss?",
    "chat.welcomeGeneral": "Welcome! I'm your teaching assistant. Select a student from the sidebar for contextual support.",
    "chat.openerStudent": "What would you like to do?",
    "chat.openerGeneral": "Select a student to get started, or type a message.",
    "chat.quickActionGeneratePlan": "Generate weekly plan",
    "chat.quickActionMakeEasier": "Make easier",
    "chat.quickActionAddStrategy": "Add strategy",
    "chat.planApprovalLine": "You can approve or request changes in the Plan tab — use Decline and send feedback to revise.",
    "chat.inputPlaceholder": "Message about {name}...",
    "chat.inputPlaceholderGeneral": "Type your message...",
    "chat.sendHint": "Enter to send / Shift+Enter for new line",
    "chat.listening": "Listening...",
    "chat.speechNotSupported": "Speech recognition is not supported in this browser.",
    "chat.attachFile": "Attach file",

    // Context Panel
    "context.summary": "Summary",
    "context.plan": "Plan",
    "context.save": "Save",
    "context.close": "Close panel",
    "context.studentSummary": "Student Summary",
    "context.generatedPlan": "Generated Plan",
    "context.strengths": "Strengths",
    "context.challenges": "Challenges",
    "context.recentNotes": "Recent Notes",
    "context.suggestedNextSteps": "Suggested Next Steps",
    "context.agentOutputs": "Agent Outputs",
    "context.agentPlaceholder": "Agents will populate this panel once connected",
    "context.studentId": "Student ID",
    "context.class": "Class",

    // Settings
    "settings.title": "Settings",
    "settings.theme": "Theme",
    "settings.themeDark": "Dark",
    "settings.themeLight": "Light",
    "settings.themeSystem": "System",
    "settings.language": "Language",
    "settings.langEn": "English",
    "settings.langAr": "Arabic",
    "settings.privacy": "Privacy Policy",
    "settings.privacyText": "Your data is handled securely and in accordance with applicable privacy regulations. This is a placeholder for the full privacy policy.",
    "settings.logout": "Log out",
    "settings.logoutConfirm": "Are you sure you want to log out?",

    // Status
    "status.mvp": "MVP Mode",
    "status.comingSoon": "Coming soon -- connect agents",

    // Theme toggle
    "theme.toggle": "Toggle theme",
  },
  ar: {
    // Login
    "login.title": "EACH",
    "login.subtitle": "\u0633\u062c\u0651\u0644 \u0627\u0644\u062f\u062e\u0648\u0644 \u0644\u0644\u0648\u0635\u0648\u0644 \u0625\u0644\u0649 \u0627\u0644\u0635\u0641\u0648\u0641 \u0648\u0627\u0644\u0637\u0644\u0627\u0628 \u0648\u0645\u0633\u0627\u062d\u0629 \u0627\u0644\u0639\u0645\u0644.",
    "login.email": "\u0627\u0644\u0628\u0631\u064a\u062f \u0627\u0644\u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a",
    "login.password": "\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631",
    "login.submit": "\u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062f\u062e\u0648\u0644",
    "login.privacy": "\u0627\u0644\u062e\u0635\u0648\u0635\u064a\u0629",
    "login.terms": "\u0627\u0644\u0634\u0631\u0648\u0637",
    "login.about": "\u062d\u0648\u0644",

    // Sidebar
    "sidebar.home": "\u0627\u0644\u0631\u0626\u064a\u0633\u064a\u0629",
    "sidebar.classes": "\u0627\u0644\u0635\u0641\u0648\u0641",
    "sidebar.students": "\u0627\u0644\u0637\u0644\u0627\u0628",
    "sidebar.recentChats": "\u0627\u0644\u0645\u062d\u0627\u062f\u062b\u0627\u062a \u0627\u0644\u0623\u062e\u064a\u0631\u0629",
    "sidebar.settings": "\u0627\u0644\u0625\u0639\u062f\u0627\u062f\u0627\u062a",
    "sidebar.collapse": "\u0637\u064a \u0627\u0644\u0634\u0631\u064a\u0637 \u0627\u0644\u062c\u0627\u0646\u0628\u064a",
    "sidebar.expand": "\u062a\u0648\u0633\u064a\u0639 \u0627\u0644\u0634\u0631\u064a\u0637 \u0627\u0644\u062c\u0627\u0646\u0628\u064a",
    "sidebar.search": "\u0628\u062d\u062b...",

    // Home
    "home.searchPlaceholder": "\u0627\u0628\u062d\u062b \u0639\u0646 \u0637\u0644\u0627\u0628\u060c \u0635\u0641\u0648\u0641...",
    "home.subtitle": "\u0627\u0628\u062d\u062b \u0639\u0646 \u0637\u0627\u0644\u0628 \u0623\u0648 \u0635\u0641 \u0644\u0644\u0628\u062f\u0621",
    "home.noResults": "\u0644\u0627 \u062a\u0648\u062c\u062f \u0646\u062a\u0627\u0626\u062c \u0644\u0640",
    "home.classes": "\u0627\u0644\u0635\u0641\u0648\u0641",
    "home.students": "\u0627\u0644\u0637\u0644\u0627\u0628",
    "home.studentsCount": "\u0637\u0644\u0627\u0628",

    // Classes
    "classes.title": "\u0627\u0644\u0635\u0641\u0648\u0641",
    "classes.listView": "\u0639\u0631\u0636 \u0642\u0627\u0626\u0645\u0629",
    "classes.gridView": "\u0639\u0631\u0636 \u0634\u0628\u0643\u0629",

    // Students
    "students.title": "\u0627\u0644\u0637\u0644\u0627\u0628",

    // Chat
    "chat.welcomeStudent": "\u0645\u0631\u062d\u0628\u0627\u064b! \u0623\u0646\u0627 \u062c\u0627\u0647\u0632 \u0644\u0645\u0633\u0627\u0639\u062f\u062a\u0643 \u0641\u064a \u062e\u0637\u0629 \u062a\u0639\u0644\u0645 {name}. \u0645\u0627\u0630\u0627 \u062a\u0631\u064a\u062f \u0645\u0646\u0627\u0642\u0634\u062a\u0647\u061f",
    "chat.welcomeGeneral": "\u0645\u0631\u062d\u0628\u0627\u064b! \u0623\u0646\u0627 \u0645\u0633\u0627\u0639\u062f\u0643 \u0627\u0644\u062a\u0639\u0644\u064a\u0645\u064a. \u0627\u062e\u062a\u0631 \u0637\u0627\u0644\u0628\u0627\u064b \u0645\u0646 \u0627\u0644\u0634\u0631\u064a\u0637 \u0627\u0644\u062c\u0627\u0646\u0628\u064a \u0644\u0644\u062f\u0639\u0645 \u0627\u0644\u0633\u064a\u0627\u0642\u064a.",
    "chat.openerStudent": "\u0645\u0627\u0630\u0627 \u062a\u0631\u064a\u062f \u0623\u0646 \u062a\u0641\u0639\u0644\u061f",
    "chat.openerGeneral": "\u0627\u062e\u062a\u0631 \u0637\u0627\u0644\u0628\u0627\u064b \u0644\u0644\u0628\u062f\u0621\u060c \u0623\u0648 \u0627\u0643\u062a\u0628 \u0631\u0633\u0627\u0644\u062a\u0643.",
    "chat.quickActionGeneratePlan": "\u0625\u0646\u0634\u0627\u0621 \u062e\u0637\u0629 \u0623\u0633\u0628\u0648\u0639\u064a\u0629",
    "chat.quickActionMakeEasier": "\u062c\u0639\u0644\u0647 \u0623\u0633\u0647\u0644",
    "chat.quickActionAddStrategy": "\u0625\u0636\u0627\u0641\u0629 \u0627\u0633\u062a\u0631\u0627\u062a\u064a\u062c\u064a\u0629",
    "chat.planApprovalLine": "\u064a\u0645\u0643\u0646\u0643 \u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0629 \u0623\u0648 \u0637\u0644\u0628 \u062a\u063a\u064a\u064a\u0631\u0627\u062a \u0641\u064a \u0628\u0637\u0627\u0642\u0629 \u0627\u0644\u062e\u0637\u0629 \u2014 \u0627\u0633\u062a\u062e\u062f\u0645 \u0627\u0644\u0631\u0641\u0636 \u0648\u0623\u0631\u0633\u0644 \u062a\u063a\u0630\u064a\u0627\u062a \u0644\u0644\u062a\u0639\u062f\u064a\u0644.",
    "chat.inputPlaceholder": "\u0631\u0633\u0627\u0644\u0629 \u062d\u0648\u0644 {name}...",
    "chat.inputPlaceholderGeneral": "\u0627\u0643\u062a\u0628 \u0631\u0633\u0627\u0644\u062a\u0643...",
    "chat.sendHint": "Enter \u0644\u0644\u0625\u0631\u0633\u0627\u0644 / Shift+Enter \u0644\u0633\u0637\u0631 \u062c\u062f\u064a\u062f",
    "chat.listening": "\u062c\u0627\u0631\u064d \u0627\u0644\u0627\u0633\u062a\u0645\u0627\u0639...",
    "chat.speechNotSupported": "\u0627\u0644\u062a\u0639\u0631\u0641 \u0639\u0644\u0649 \u0627\u0644\u0643\u0644\u0627\u0645 \u063a\u064a\u0631 \u0645\u062f\u0639\u0648\u0645 \u0641\u064a \u0647\u0630\u0627 \u0627\u0644\u0645\u062a\u0635\u0641\u062d.",
    "chat.attachFile": "\u0625\u0631\u0641\u0627\u0642 \u0645\u0644\u0641",

    // Context Panel
    "context.summary": "\u0627\u0644\u0645\u0644\u062e\u0635",
    "context.plan": "\u0627\u0644\u062e\u0637\u0629",
    "context.save": "\u062d\u0641\u0638",
    "context.close": "\u0625\u063a\u0644\u0627\u0642 \u0627\u0644\u0644\u0648\u062d\u0629",
    "context.studentSummary": "\u0645\u0644\u062e\u0635 \u0627\u0644\u0637\u0627\u0644\u0628",
    "context.generatedPlan": "\u0627\u0644\u062e\u0637\u0629 \u0627\u0644\u0645\u0648\u0644\u062f\u0629",
    "context.strengths": "\u0646\u0642\u0627\u0637 \u0627\u0644\u0642\u0648\u0629",
    "context.challenges": "\u0627\u0644\u062a\u062d\u062f\u064a\u0627\u062a",
    "context.recentNotes": "\u0645\u0644\u0627\u062d\u0638\u0627\u062a \u062d\u062f\u064a\u062b\u0629",
    "context.suggestedNextSteps": "\u0627\u0644\u062e\u0637\u0648\u0627\u062a \u0627\u0644\u0645\u0642\u062a\u0631\u062d\u0629 \u0627\u0644\u062a\u0627\u0644\u064a\u0629",
    "context.agentOutputs": "\u0645\u062e\u0631\u062c\u0627\u062a \u0627\u0644\u0648\u0643\u064a\u0644",
    "context.agentPlaceholder": "\u0633\u064a\u0642\u0648\u0645 \u0627\u0644\u0648\u0643\u0644\u0627\u0621 \u0628\u0645\u0644\u0621 \u0647\u0630\u0647 \u0627\u0644\u0644\u0648\u062d\u0629 \u0628\u0645\u062c\u0631\u062f \u0627\u0644\u0627\u062a\u0635\u0627\u0644",
    "context.studentId": "\u0631\u0642\u0645 \u0627\u0644\u0637\u0627\u0644\u0628",
    "context.class": "\u0627\u0644\u0635\u0641",

    // Settings
    "settings.title": "\u0627\u0644\u0625\u0639\u062f\u0627\u062f\u0627\u062a",
    "settings.theme": "\u0627\u0644\u0645\u0638\u0647\u0631",
    "settings.themeDark": "\u062f\u0627\u0643\u0646",
    "settings.themeLight": "\u0641\u0627\u062a\u062d",
    "settings.themeSystem": "\u0627\u0644\u0646\u0638\u0627\u0645",
    "settings.language": "\u0627\u0644\u0644\u063a\u0629",
    "settings.langEn": "English",
    "settings.langAr": "\u0627\u0644\u0639\u0631\u0628\u064a\u0629",
    "settings.privacy": "\u0633\u064a\u0627\u0633\u0629 \u0627\u0644\u062e\u0635\u0648\u0635\u064a\u0629",
    "settings.privacyText": "\u064a\u062a\u0645 \u0627\u0644\u062a\u0639\u0627\u0645\u0644 \u0645\u0639 \u0628\u064a\u0627\u0646\u0627\u062a\u0643 \u0628\u0634\u0643\u0644 \u0622\u0645\u0646 \u0648\u0648\u0641\u0642\u064b\u0627 \u0644\u0644\u0648\u0627\u0626\u062d \u0627\u0644\u0645\u0639\u0645\u0648\u0644 \u0628\u0647\u0627. \u0647\u0630\u0627 \u0646\u0635 \u0645\u0624\u0642\u062a \u0644\u0633\u064a\u0627\u0633\u0629 \u0627\u0644\u062e\u0635\u0648\u0635\u064a\u0629 \u0627\u0644\u0643\u0627\u0645\u0644\u0629.",
    "settings.logout": "\u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062e\u0631\u0648\u062c",
    "settings.logoutConfirm": "\u0647\u0644 \u0623\u0646\u062a \u0645\u062a\u0623\u0643\u062f \u0623\u0646\u0643 \u062a\u0631\u064a\u062f \u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062e\u0631\u0648\u062c\u061f",

    // Status
    "status.mvp": "\u0648\u0636\u0639 MVP",
    "status.comingSoon": "\u0642\u0631\u064a\u0628\u0627\u064b -- \u0631\u0628\u0637 \u0627\u0644\u0648\u0643\u0644\u0627\u0621",

    // Theme toggle
    "theme.toggle": "\u062a\u0628\u062f\u064a\u0644 \u0627\u0644\u0645\u0638\u0647\u0631",
  },
}

export function t(locale: Locale, key: string, params?: Record<string, string>): string {
  let value = translations[locale][key] || translations.en[key] || key
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      value = value.replace(`{${k}}`, v)
    })
  }
  return value
}

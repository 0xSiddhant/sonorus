module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Allowed types — must match .agents/rules/git.md
    'type-enum': [2, 'always', ['feat', 'fix', 'refactor', 'style', 'chore', 'docs', 'test', 'ci', 'build', 'perf', 'revert']],
    // Lowercase subject
    'subject-case': [2, 'always', 'lower-case'],
    // No trailing period
    'subject-full-stop': [2, 'never', '.'],
    // Max 72 characters total
    'header-max-length': [2, 'always', 72],
    // Subject must not be empty
    'subject-empty': [2, 'never'],
    // Type must not be empty
    'type-empty': [2, 'never'],
  },
}

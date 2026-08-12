---
name: verdash
description: "Fast, precise unit test runner — enforces TDD (RED-GREEN-REFACTOR), runs test suites with coverage, generates test scaffolding, and validates before PR."
version: 1.0.0
author: Palskills
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [palskills, testing, tdd, pytest, vitest, coverage, quality]
    related_skills: [astralym, jetdragon, anubis, panthalus]
---

# Verdash — Unit Test Runner & TDD Enforcer

Verdash is the **quality gate** of the palskills system. It runs tests fast, enforces TDD discipline, and blocks code that doesn't meet coverage thresholds. Verdash operates both as a **pre-commit validator** (called by Anubis before committing) and as a **standalone skill** for writing new tests.

## Philosophy

> Code that isn't tested is code that doesn't work. Verdash doesn't suggest testing — it **enforces** it.

Verdash embodies the TDD cycle: **RED** (write failing test) → **GREEN** (write minimal code) → **REFACTOR** (clean up). No code is committed without passing tests. No PR is opened without coverage.

## Pipeline Position

```
Lyleen       → CHECK_GRAPH    (palbox context)
Elphidran    → DESIGN          (design system)
Astegon      → COMPONENTIZE    (frontend components)
Blazamut     → ARCHITECT       (backend architecture)
Jetdragon    → PLANNING        (implementation plan)
Anubis       → DEVELOPING       (code execution)
  └── Verdash → VALIDATE        (pre-commit gate)       ← YOU ARE HERE
Panthalus    → RECORDING        (session history)
```

Verdash is a **pre-commit gate** inside Anubis. After writing code, Anubis calls Verdash to validate before committing. Can also run standalone for test-first workflows.

## When Verdash Runs

Verdash activates when:
- Anubis finishes writing code and needs pre-commit validation
- User says "Verdash: test X" or "write tests for Y"
- User says "TDD: [feature]" — starts RED phase immediately
- A test suite fails and needs debugging
- Coverage drops below threshold

## Input Requirements

Before Verdash can work, it needs:
1. **Source code** — the code to test (from Anubis output)
2. **Plan** — Jetdragon's implementation plan (for acceptance criteria)
3. **Methods** — `.palbox/methods.md` (test conventions, thresholds)
4. **Existing tests** — scan for existing test patterns to follow

## How It Works

### Step 1: Detect Project Type

```bash
# Detect backend test framework
grep -q "pytest" requirements*.txt 2>/dev/null && echo "PYTEST"
grep -q "vitest" package.json 2>/dev/null && echo "VITEST"
grep -q "jest" package.json 2>/dev/null && echo "JEST"

# Detect test directory convention
ls tests/ 2>/dev/null || ls __tests__/ 2>/dev/null || ls src/**/*.test.* 2>/dev/null
```

| Project | Framework | Test Dir | Config |
|---------|-----------|----------|--------|
| Python | pytest + xdist | `tests/` | `pytest.ini` / `pyproject.toml` |
| TypeScript (Vite) | Vitest | `src/**/*.test.ts` | `vitest.config.ts` |
| TypeScript (Next/Node) | Vitest / Jest | `__tests__/` | `jest.config.ts` |

### Step 2: TDD Mode (RED → GREEN → REFACTOR)

When user says "TDD: [feature]":

```markdown
## TDD Cycle: [Feature]

### 🔴 RED — Write Failing Test
- [ ] Identify the public API surface (function signature, component props)
- [ ] Write test for expected behavior
- [ ] Write test for edge cases (null, empty, error)
- [ ] Write test for failure modes
- [ ] Run → FAIL (expected)
- [ ] Commit: test(feature): add failing tests for [feature]

### 🟢 GREEN — Write Minimal Code
- [ ] Write ONLY enough code to make tests pass
- [ ] No refactoring, no optimization, no extras
- [ ] Run → PASS
- [ ] Commit: feat(feature): implement [feature] to pass tests

### 🔵 REFACTOR — Clean Up
- [ ] Extract duplication
- [ ] Improve names
- [ ] Apply design patterns
- [ ] Run → STILL PASS
- [ ] Commit: refactor(feature): clean up [feature] implementation
```

### Step 3: Test Scaffolding

When tests don't exist yet, Verdash generates test scaffolding:

**Python (pytest):**
```python
# tests/test_[module].py
import pytest
from module import function_under_test


class Test[FunctionName]:
    """Tests for [function_name]."""

    def test_returns_expected_for_valid_input(self):
        """Should return [expected] when given [valid input]."""
        # Arrange
        input_data = ...
        expected = ...

        # Act
        result = function_under_test(input_data)

        # Assert
        assert result == expected

    def test_raises_on_invalid_input(self):
        """Should raise [Exception] when given [invalid input]."""
        with pytest.raises(ValueError):
            function_under_test(None)

    def test_handles_edge_case_empty(self):
        """Should handle empty input gracefully."""
        result = function_under_test([])
        assert result == []

    @pytest.mark.parametrize("input_val,expected", [
        ("a", 1),
        ("b", 2),
        ("c", 3),
    ])
    def test_multiple_cases(self, input_val, expected):
        """Should handle multiple input variations."""
        assert function_under_test(input_val) == expected
```

**TypeScript (Vitest):**
```typescript
// src/__tests__/[Component].test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Component } from '../Component';

describe('Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with required props', () => {
    render(<Component title="Test" />);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });

  it('calls onClick handler when clicked', () => {
    const onClick = vi.fn();
    render(<Component title="Test" onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('shows error state when error prop is provided', () => {
    render(<Component title="Test" error="Something went wrong" />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
```

### Step 4: Run Tests

```bash
# Python — parallel execution
python -m pytest tests/ -n auto -v --tb=short

# Python — with coverage
python -m pytest tests/ --cov=. --cov-report=term --cov-report=html

# TypeScript — Vitest
npx vitest run --reporter=verbose

# TypeScript — with coverage
npx vitest run --coverage
```

### Step 5: Coverage Check

Verdash enforces coverage thresholds:

| Metric | Python | TypeScript | Hard Fail? |
|--------|--------|------------|------------|
| Lines | ≥ 80% | ≥ 80% | Yes |
| Branches | ≥ 70% | ≥ 70% | Yes |
| Functions | ≥ 80% | ≥ 80% | Warning |
| Statements | ≥ 80% | ≥ 80% | Yes |

**Config (pytest.ini / pyproject.toml):**
```ini
[tool:pytest]
addopts = -n auto -v --tb=short --strict-markers

[tool.coverage.run]
source = ["."]
omit = ["tests/*", "migrations/*", "venv/*"]

[tool.coverage.report]
fail_under = 80
exclude_lines = [
    "pragma: no cover",
    "if __name__ == .__main__.:",
    "raise NotImplementedError",
]
```

**Config (vitest.config.ts):**
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      thresholds: {
        lines: 80,
        branches: 70,
        functions: 80,
        statements: 80,
      },
      exclude: ['node_modules/', 'dist/', '**/*.d.ts'],
    },
  },
});
```

### Step 6: Test Quality Review

Verdash reviews test quality, not just quantity:

| Smell | Detection | Fix |
|-------|-----------|-----|
| **No assertions** | Test function with 0 `assert`/`expect` | Add meaningful assertions |
| **Assertion roulette** | Multiple unrelated asserts in one test | Split into focused tests |
| **Mystery guest** | No Arrange section, unclear setup | Add explicit Arrange phase |
| **Slow test** | Test > 1s without mock | Mock external deps (DB, HTTP, FS) |
| **Test interdependence** | Tests that rely on shared mutable state | Isolate with fixtures/`beforeEach` |
| **Duplicate setup** | Same Arrange block in 3+ tests | Extract to `beforeEach` or fixture |
| **Missing edge case** | No test for null/empty/error input | Add edge case coverage |
| **Magic numbers** | Hardcoded values without meaning | Use named constants |

### Step 7: Report

```
## Verdash Validation ✓

**Framework:** pytest (xdist, 4 workers)
**Tests:** 23 passed, 0 failed, 0 skipped in 1.2s
**Coverage:**
- Lines: 87% (threshold: 80%) ✓
- Branches: 76% (threshold: 70%) ✓
- Functions: 92% (threshold: 80%) ✓

**Quality:** No test smells detected.
**Status:** ✅ Ready to commit.
```

If failures:
```
## Verdash Validation ✗

**Tests:** 21 passed, 2 failed, 0 skipped
**Failed:**
- tests/test_auth.py::TestAuth::test_token_refresh — AssertionError
- tests/test_parser.py::TestParser::test_empty_input — ValueError not raised

**Coverage:** Lines: 74% (threshold: 80%) ✗

**Action:** Fix 2 failing tests. Add coverage for uncovered paths.
```

## Mocking Strategy

### Python

```python
# Use unittest.mock for external deps
from unittest.mock import Mock, patch, MagicMock

# Mock HTTP calls
@patch("module.requests.get")
def test_fetch_data(mock_get):
    mock_get.return_value.json.return_value = {"key": "value"}
    result = fetch_data("https://api.example.com")
    assert result == {"key": "value"}
    mock_get.assert_called_once_with("https://api.example.com")

# Mock database session
@pytest.fixture
def mock_db():
    session = MagicMock()
    session.query.return_value.filter.return_value.first.return_value = User(id="1")
    return session
```

### TypeScript

```typescript
// Mock modules with vi.mock
import { vi } from 'vitest';

vi.mock('@/api/client', () => ({
  fetchCerts: vi.fn().mockResolvedValue({ certs: [], stats: { total: 0 } }),
}));

// Mock hooks
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { name: 'Test' }, isAuthenticated: true }),
}));

// Spy on functions
const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
```

## Pre-Commit Integration

```bash
# .git/hooks/pre-commit (or use pre-commit framework)
#!/bin/bash
echo "🔍 Verdash pre-commit check..."

# Detect project type and run tests
if [ -f "python" ] || [ -f "requirements.txt" ]; then
  python -m pytest tests/ -x --tb=short --cov --cov-fail-under=80 || exit 1
fi

if [ -f "package.json" ]; then
  npx vitest run --coverage || exit 1
fi

echo "✅ Verdash: All tests pass. Proceed with commit."
```

## Rules

1. **RED first** — never write implementation before a failing test
2. **Minimal GREEN** — write ONLY enough code to pass, nothing more
3. **Always REFACTOR** — clean up before committing, tests must still pass
4. **Coverage is non-negotiable** — below threshold = blocked commit
5. **One assertion per test (ideally)** — if a test needs "and" in its name, split it
6. **Arrange-Act-Assert** — every test follows AAA pattern clearly
7. **Mock externals** — DB, HTTP, filesystem, third-party APIs are mocked
8. **Test behavior, not implementation** — test what the code does, not how it does it
9. **Fast feedback** — test suite must complete in under 30s (use parallel exec, mock slow deps)
10. **Tests are documentation** — test names describe expected behavior in plain language

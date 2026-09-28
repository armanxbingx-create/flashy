---
name: learning-ux
description: Implement and review flashcard, five-box, gesture, feedback, and learning interactions for the Vocabulary App.
compatibility: opencode
---

# Learning UX Skill

Read `project-spec.md` before changing learning behavior.

## V1 learning model

Five boxes:

- new cards start in Box 1
- correct advances one box
- incorrect returns to Box 1
- Box 5 remains Box 5 on correct
- priority is the lowest-numbered non-empty box

## Review interaction

- swipe left = incorrect
- swipe right = correct
- explicit buttons always remain available
- reveal is available through a visible control
- reveal may also respond to tap/vertical interaction
- gestures must never be the only way to complete a task

## Feedback

Use visual feedback first.

Haptics are optional progressive enhancement and must never be required for correctness.

Do not depend on the Web Vibration API.

## Performance

Keep card gestures smooth on iPhone 8.

Prefer transform/opacity.

Avoid continuous JS animation loops and expensive filter effects.

## Separation of concerns

Do not put learning rules directly into React components.

Use the `LearningEngine` abstraction and test state transitions independently.

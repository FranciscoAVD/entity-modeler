# Conventions

- Any conditional or computed logic in a `className` prop must go through the `cn()`
  utility (`@/lib/utils`), not raw template-string concatenation or ternaries spliced
  directly into a plain string.

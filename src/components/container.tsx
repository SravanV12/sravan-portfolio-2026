import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";

type ContainerProps = {
  /** Render as a semantic element where one is warranted — section, main, footer. */
  as?: ElementType;
  className?: string;
  children: ReactNode;
} & Omit<ComponentPropsWithoutRef<"div">, "as" | "className" | "children">;

/**
 * The only thing in the codebase allowed to set horizontal page padding.
 * Everything that needs to sit on the grid goes through it.
 */
export function Container({
  as: Tag = "div",
  className = "",
  children,
  ...rest
}: ContainerProps) {
  return (
    <Tag
      {...rest}
      className={`mx-auto w-full max-w-page px-6 sm:px-8 lg:px-12 ${className}`.trimEnd()}
    >
      {children}
    </Tag>
  );
}

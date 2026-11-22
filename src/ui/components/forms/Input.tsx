
import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { AlertCircle } from "lucide-react";

export interface InputProps
  extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  containerClassName?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      containerClassName = "",
      className = "",
      id,
      disabled,
      ...props
    },
    ref
  ) => {
    const inputId =
      id ?? props.name ?? `input-${props.type ?? "text"}`;

    return (
      <div className={`wp-form-field ${containerClassName}`}>
        {label && (
          <label
            htmlFor={inputId}
            className="wp-label"
          >
            {label}
            {props.required && (
              <span className="wp-input-required">*</span>
            )}
          </label>
        )}

        <div
          className={`
            wp-input-wrapper
            ${error ? "wp-input-wrapper-error" : ""}
            ${disabled ? "wp-input-wrapper-disabled" : ""}
            ${className}
          `}
        >
          {leftIcon && (
            <span className="wp-input-icon wp-input-icon-left">
              {leftIcon}
            </span>
          )}

          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            aria-invalid={!!error}
            aria-describedby={
              error
                ? `${inputId}-error`
                : helperText
                  ? `${inputId}-helper`
                  : undefined
            }
            className="wp-input"
            {...props}
          />

          {rightIcon && (
            <span className="wp-input-icon wp-input-icon-right">
              {rightIcon}
            </span>
          )}
        </div>

        {error && (
          <p
            id={`${inputId}-error`}
            className="wp-input-error-message"
            role="alert"
          >
            <AlertCircle size={14} />
            {error}
          </p>
        )}

        {!error && helperText && (
          <p
            id={`${inputId}-helper`}
            className="wp-input-helper"
          >
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

export default Input;

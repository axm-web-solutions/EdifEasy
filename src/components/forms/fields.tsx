import type { ReactNode } from 'react'
import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form'
import { DatePicker, Form, Input, InputNumber, Select, Switch } from 'antd'
import dayjs from 'dayjs'

const { TextArea } = Input

export interface FieldOption {
  value: string
  label: string
  disabled?: boolean
}

interface BaseProps<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>
  name: FieldPath<TFieldValues>
  label?: ReactNode
  required?: boolean
  help?: ReactNode
  placeholder?: string
  disabled?: boolean
  className?: string
}

/**
 * Todos los campos comparten el mismo contrato: se conectan a React Hook Form
 * mediante `Controller`, enlazan la etiqueta con el control (`htmlFor`/`id`)
 * para que sean accesibles, y muestran el error de Zod debajo del control.
 */
function FieldWrapper({
  htmlFor,
  label,
  required,
  help,
  error,
  children,
  className,
}: {
  htmlFor: string
  label?: ReactNode
  required?: boolean
  help?: ReactNode
  error?: string
  children: ReactNode
  className?: string
}) {
  return (
    <Form.Item
      label={label}
      htmlFor={htmlFor}
      required={required}
      validateStatus={error ? 'error' : undefined}
      help={error ?? help}
      className={className}
      layout="vertical"
    >
      {children}
    </Form.Item>
  )
}

export function TextField<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  required,
  help,
  placeholder,
  disabled,
  className,
  type = 'text',
  maxLength,
  prefix,
}: BaseProps<TFieldValues> & { type?: string; maxLength?: number; prefix?: ReactNode }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FieldWrapper
          htmlFor={name}
          label={label}
          required={required}
          help={help}
          error={fieldState.error?.message}
          className={className}
        >
          {type === 'password' ? (
            <Input.Password
              {...field}
              id={name}
              value={(field.value as string) ?? ''}
              placeholder={placeholder}
              disabled={disabled}
              maxLength={maxLength}
              autoComplete="current-password"
            />
          ) : (
            <Input
              {...field}
              id={name}
              value={(field.value as string) ?? ''}
              type={type}
              prefix={prefix}
              placeholder={placeholder}
              disabled={disabled}
              maxLength={maxLength}
            />
          )}
        </FieldWrapper>
      )}
    />
  )
}

export function TextAreaField<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  required,
  help,
  placeholder,
  disabled,
  className,
  rows = 4,
  maxLength,
}: BaseProps<TFieldValues> & { rows?: number; maxLength?: number }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FieldWrapper
          htmlFor={name}
          label={label}
          required={required}
          help={help}
          error={fieldState.error?.message}
          className={className}
        >
          <TextArea
            {...field}
            id={name}
            value={(field.value as string) ?? ''}
            rows={rows}
            maxLength={maxLength}
            showCount={Boolean(maxLength)}
            placeholder={placeholder}
            disabled={disabled}
          />
        </FieldWrapper>
      )}
    />
  )
}

export function NumberField<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  required,
  help,
  placeholder,
  disabled,
  className,
  min,
  max,
  step = 1,
  precision,
  addonBefore,
}: BaseProps<TFieldValues> & {
  min?: number
  max?: number
  step?: number
  precision?: number
  addonBefore?: ReactNode
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FieldWrapper
          htmlFor={name}
          label={label}
          required={required}
          help={help}
          error={fieldState.error?.message}
          className={className}
        >
          <InputNumber
            id={name}
            className="w-full"
            value={(field.value as number | null) ?? null}
            onChange={(value) => field.onChange(value)}
            onBlur={field.onBlur}
            min={min}
            max={max}
            step={step}
            precision={precision}
            addonBefore={addonBefore}
            placeholder={placeholder}
            disabled={disabled}
          />
        </FieldWrapper>
      )}
    />
  )
}

export function SelectField<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  required,
  help,
  placeholder,
  disabled,
  className,
  options,
  allowClear = false,
  showSearch = true,
  mode,
  loading,
  onChangeExtra,
}: BaseProps<TFieldValues> & {
  options: FieldOption[]
  allowClear?: boolean
  showSearch?: boolean
  mode?: 'multiple' | 'tags'
  loading?: boolean
  onChangeExtra?: (value: string | string[] | null) => void
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FieldWrapper
          htmlFor={name}
          label={label}
          required={required}
          help={help}
          error={fieldState.error?.message}
          className={className}
        >
          <Select
            id={name}
            value={(field.value as string | string[] | null) || undefined}
            onChange={(value) => {
              field.onChange(value ?? null)
              onChangeExtra?.(value as string | string[] | null)
            }}
            onBlur={field.onBlur}
            options={options}
            mode={mode}
            loading={loading}
            allowClear={allowClear}
            showSearch={showSearch}
            optionFilterProp="label"
            placeholder={placeholder}
            disabled={disabled}
            className="w-full"
            maxTagCount="responsive"
          />
        </FieldWrapper>
      )}
    />
  )
}

export function DateField<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  required,
  help,
  placeholder,
  disabled,
  className,
  showTime = false,
}: BaseProps<TFieldValues> & { showTime?: boolean }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FieldWrapper
          htmlFor={name}
          label={label}
          required={required}
          help={help}
          error={fieldState.error?.message}
          className={className}
        >
          <DatePicker
            id={name}
            className="w-full"
            value={field.value ? dayjs(field.value as string) : null}
            onChange={(date) =>
              field.onChange(date ? (showTime ? date.toISOString() : date.format('YYYY-MM-DD')) : null)
            }
            onBlur={field.onBlur}
            showTime={showTime ? { format: 'HH:mm' } : false}
            format={showTime ? 'DD/MM/YYYY HH:mm' : 'DD/MM/YYYY'}
            placeholder={placeholder ?? 'Selecciona una fecha'}
            disabled={disabled}
          />
        </FieldWrapper>
      )}
    />
  )
}

export function SwitchField<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  help,
  disabled,
  className,
  checkedLabel = 'Si',
  uncheckedLabel = 'No',
}: BaseProps<TFieldValues> & { checkedLabel?: string; uncheckedLabel?: string }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FieldWrapper
          htmlFor={name}
          label={label}
          help={help}
          error={fieldState.error?.message}
          className={className}
        >
          <Switch
            id={name}
            checked={Boolean(field.value)}
            onChange={(checked) => field.onChange(checked)}
            checkedChildren={checkedLabel}
            unCheckedChildren={uncheckedLabel}
            disabled={disabled}
          />
        </FieldWrapper>
      )}
    />
  )
}

export function ColorField<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  required,
  help,
  disabled,
  className,
}: BaseProps<TFieldValues>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FieldWrapper
          htmlFor={name}
          label={label}
          required={required}
          help={help}
          error={fieldState.error?.message}
          className={className}
        >
          <div className="flex items-center gap-2">
            <input
              id={name}
              type="color"
              value={(field.value as string) ?? '#2559eb'}
              onChange={(event) => field.onChange(event.target.value)}
              disabled={disabled}
              className="h-8 w-12 cursor-pointer rounded border border-slate-200 bg-white p-1"
              aria-label="Selector de color"
            />
            <Input
              value={(field.value as string) ?? ''}
              onChange={(event) => field.onChange(event.target.value)}
              onBlur={field.onBlur}
              disabled={disabled}
              className="w-32"
            />
          </div>
        </FieldWrapper>
      )}
    />
  )
}

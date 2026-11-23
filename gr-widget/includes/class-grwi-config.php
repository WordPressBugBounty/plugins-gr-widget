<?php

defined('ABSPATH') || exit;

/** Closed, local configuration schema for the WordPress save boundary. */
final class GRWI_Config
{
    /**
     * Decode, validate and sanitize before any configuration reaches the service.
     * Unknown/server-generated properties are not writable through this plugin.
     *
     * @param mixed $input JSON text or submitted configuration array.
     * @return array<string, mixed>|WP_Error
     */
    public static function sanitize($input)
    {
        if (is_string($input)) {
            if (strlen($input) > 1048576) {
                return self::invalid();
            }
            $input = json_decode($input, true, 16);
            if (json_last_error() !== JSON_ERROR_NONE) {
                return self::invalid();
            }
        }
        if (! is_array($input) || count($input) > 1500) {
            return self::invalid();
        }
        if (self::contains_code($input)) {
            return new WP_Error('grwi_custom_code_disabled', __('JavaScript, PHP and HTML cannot be saved through the WordPress plugin.', 'gr-widget'), ['status' => 422]);
        }
        $schema = json_decode((string) file_get_contents(__DIR__ . '/config-schema.json'), true);
        if (! is_array($schema)) {
            return self::invalid();
        }
        $clean = [];
        foreach ($input as $key => $value) {
            if (! is_string($key) || ! isset($schema[$key])) {
                continue;
            }
            $spec = $schema[$key];
            $sanitized = self::value($value, $spec);
            if (is_wp_error($sanitized)) {
                return $sanitized;
            }
            $clean[$key] = $sanitized;
        }

        return $clean;
    }

    /** @param mixed $value @param array<string, mixed> $spec @return mixed */
    private static function value($value, array $spec)
    {
        $type = $spec['type'];
        if ($type === 'list') {
            if (is_string($value) && $spec['item'] === 'text') {
                $value = explode(',', $value);
            }
            if (! is_array($value) || count($value) > 5000 || array_keys($value) !== range(0, count($value) - 1) && $value !== []) {
                return self::invalid();
            }
            $items = [];
            foreach ($value as $item) {
                if (! is_string($item) && ! is_int($item)) {
                    return self::invalid();
                }
                $item = sanitize_text_field((string) $item);
                if (strlen($item) > 500 || $spec['item'] === 'id' && ! preg_match('/^[a-zA-Z0-9_.:\/-]+$/D', $item)
                    || $spec['item'] === 'element' && ! in_array($item, $spec['values'], true)) {
                    return self::invalid();
                }
                if ($item !== '') {
                    $items[] = $item;
                }
            }

            return array_values(array_unique($items));
        }
        if (! is_scalar($value) && $value !== null) {
            return self::invalid();
        }
        if ($type === 'bool') {
            if (! in_array($value, [true, false, 1, 0, '1', '0', 'true', 'false', '', null], true)) {
                return self::invalid();
            }

            return in_array($value, [true, 1, '1', 'true'], true);
        }
        $text = sanitize_text_field((string) $value);
        if ($type === 'css') {
            if (strlen((string) $value) > 16384 || preg_match('/<\/?(?:script|style|iframe|object|embed)\b|javascript\s*:|@import\b|expression\s*\(/i', (string) $value)) return self::invalid();
            return trim((string) $value);
        }
        if ($type === 'text') {
            if (strlen((string) $value) > 10000) {
                return self::invalid();
            }

            return sanitize_textarea_field((string) $value);
        }
        // Empty values retain the builder's explicit automatic/default state.
        if ($text === '') {
            return '';
        }
        if ($type === 'number' || $type === 'int') {
            $with_px = $type !== 'int' && ! empty($spec['allow_px']) && substr($text, -2) === 'px';
            $number = $with_px ? substr($text, 0, -2) : $text;
            $pattern = $type === 'int' ? '/^-?\d+$/D' : '/^-?\d+(?:\.\d+)?$/D';
            if (! preg_match($pattern, $number) || (float) $number < $spec['min'] || (float) $number > $spec['max']) {
                return self::invalid();
            }

            return $with_px ? $text : (strpos($number, '.') === false ? (int) $number : (float) $number);
        }
        if ($type === 'enum') {
            return in_array($text, $spec['values'], true) ? $text : self::invalid();
        }
        if ($type === 'size') {
            if (in_array($text, ['auto', 'none', 'small', 'medium', 'large'], true)) {
                return $text;
            }
            if (! preg_match('/^(\d+(?:\.\d+)?)(px|rem|em|%)?$/D', $text, $matches) || (float) $matches[1] > 5000) {
                return self::invalid();
            }

            return $text;
        }
        if ($type === 'color') {
            if (in_array($text, ['auto', 'transparent', 'none', 'multicolour', 'multicolor', 'currentColor', 'inherit'], true)) {
                return $text;
            }
            if (sanitize_hex_color($text) !== null && sanitize_hex_color($text) !== '') {
                return sanitize_hex_color($text);
            }
            if (preg_match('/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(0(?:\.\d+)?|1(?:\.0+)?))?\s*\)$/D', $text, $parts)
                && (int) $parts[1] <= 255 && (int) $parts[2] <= 255 && (int) $parts[3] <= 255) {
                return $text;
            }
        }

        return self::invalid();
    }

    /** @param array<mixed> $input */
    private static function contains_code(array $input, int $depth = 0): bool
    {
        if ($depth > 12 || count($input) > 1500) {
            return true;
        }
        foreach ($input as $key => $value) {
            if (is_string($key) && preg_match('/^(?:custom_?(?:js|javascript|php|html)|javascript|php_code|script|scripts)$/iD', $key)
                && $value !== '' && $value !== null && $value !== false && $value !== []) {
                return true;
            }
            if (is_array($value) && self::contains_code($value, $depth + 1)) {
                return true;
            }
        }

        return false;
    }

    private static function invalid(): WP_Error
    {
        return new WP_Error('grwi_invalid_config', __('Some widget settings are invalid. Refresh the editor and check your selections.', 'gr-widget'), ['status' => 422]);
    }

    /** @return array<string, mixed>|WP_Error */
    public static function sanitize_update(array $data)
    {
        $clean = [];
        if (array_key_exists('config', $data)) {
            $clean['config'] = self::sanitize($data['config']);
            if (is_wp_error($clean['config'])) {
                return $clean['config'];
            }
        }
        if (isset($data['layout'])) {
            $layout = self::sanitize(['layout' => $data['layout']]);
            if (is_wp_error($layout)) {
                return $layout;
            }
            $clean['layout'] = $layout['layout'];
        }
        if (isset($data['name'])) {
            if (! is_string($data['name']) || strlen($data['name']) > 120) {
                return self::invalid();
            }
            $clean['name'] = sanitize_text_field($data['name']);
        }
        if (isset($data['save_mode'])) {
            if (! in_array($data['save_mode'], ['auto', 'draft', 'publish'], true)) {
                return self::invalid();
            }
            $clean['save_mode'] = $data['save_mode'];
        }
        if (isset($data['publish_plan_safe'])) {
            $clean['publish_plan_safe'] = self::value($data['publish_plan_safe'], ['type' => 'bool']);
            if (is_wp_error($clean['publish_plan_safe'])) {
                return $clean['publish_plan_safe'];
            }
        }

        return $clean;
    }

    /** @return array<string, mixed>|WP_Error */
    public static function sanitize_create(array $data)
    {
        $clean = self::sanitize_update($data);
        if (is_wp_error($clean)) {
            return $clean;
        }
        foreach (['place_id', 'business_name', 'formatted_address'] as $key) {
            if (isset($data[$key])) {
                if (! is_string($data[$key]) || strlen($data[$key]) > 1000) {
                    return self::invalid();
                }
                $clean[$key] = sanitize_text_field($data[$key]);
            }
        }
        foreach (['rating', 'review_count'] as $key) {
            if (! isset($data[$key])) {
                continue;
            }
            $value = $data[$key];
            if (is_bool($value) || ! is_scalar($value) || ! is_numeric($value)
                || (float) $value < 0 || (float) $value > ($key === 'rating' ? 5 : 100000000)
                || $key === 'review_count' && (float) $value !== (float) (int) $value) {
                return self::invalid();
            }
            $clean[$key] = $key === 'rating' ? (float) $value : (int) $value;
        }

        return $clean;
    }

    /** Remove executable-code controls; custom CSS remains a validated Site+ widget setting. */
    public static function without_code_controls(array $data): array
    {
        $clean = [];
        foreach ($data as $key => $value) {
            if (in_array($key, ['custom_js','custom_javascript','custom_php','custom_html'], true) || is_array($value) && in_array($value['key'] ?? '', ['custom_js','custom_javascript','custom_php','custom_html'], true)) {
                continue;
            }
            $clean[$key] = is_array($value) ? self::without_code_controls($value) : $value;
        }

        return $data !== [] && array_keys($data) === range(0, count($data) - 1) ? array_values($clean) : $clean;
    }
}

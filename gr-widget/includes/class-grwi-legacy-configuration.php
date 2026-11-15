<?php

defined('ABSPATH') || exit;

/** Local evidence only. Never execute builder code or contact the hosted service. */
final class GRWI_Legacy_Configuration
{
    public static function has_saved_embed(): bool
    {
        global $wpdb;
        $cursor = 0;
        do {
            // Keyset batches bound memory; stop as soon as deliberate configuration is found.
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching -- One-time keyset migration; result is persisted in grwi_legacy_authorization.
            $rows = $wpdb->get_results($wpdb->prepare(
                "SELECT ID, post_content FROM {$wpdb->posts} WHERE ID > %d
                AND post_status IN ('publish','private','future','draft','pending') AND post_type <> 'revision'
                AND (post_content LIKE %s OR post_content LIKE %s)
                ORDER BY ID LIMIT 20",
                $cursor, '%grwi%', '%grw%'
            ));
            foreach ($rows as $row) {
                $cursor = (int) $row->ID;
                if (self::content_has_embed($row->post_content)) {
                    return true;
                }
            }
        } while (count($rows) === 20);

        $cursor = 0;
        do {
            // Only documented builder storage, using the existing meta_key index.
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching -- One-time keyset migration; result is persisted in grwi_legacy_authorization.
            $rows = $wpdb->get_results($wpdb->prepare(
                "SELECT m.meta_id, m.meta_key, m.meta_value FROM {$wpdb->postmeta} m
                INNER JOIN {$wpdb->posts} p ON p.ID = m.post_id
                WHERE m.meta_id > %d AND m.meta_key IN ('_elementor_data','_bricks_page_content_2','_bricks_page_header_2','_bricks_page_footer_2')
                AND p.post_status IN ('publish','private','future','draft','pending') AND p.post_type <> 'revision'
                AND (m.meta_value LIKE %s OR m.meta_value LIKE %s)
                ORDER BY m.meta_id LIMIT 20",
                $cursor, '%grwi%', '%grw%'
            ));
            foreach ($rows as $row) {
                $cursor = (int) $row->meta_id;
                $data = $row->meta_key === '_elementor_data'
                    ? json_decode($row->meta_value, true, 64)
                    : self::decode_bricks($row->meta_value);
                if (is_array($data) && self::builder_has_embed($data, $row->meta_key === '_elementor_data')) {
                    return true;
                }
            }
        } while (count($rows) === 20);

        foreach (['widget_custom_html', 'widget_text', 'widget_block'] as $option) {
            foreach ((array) get_option($option, []) as $widget) {
                if (is_array($widget) && self::content_has_embed((string) ($widget['content'] ?? $widget['text'] ?? ''))) {
                    return true;
                }
            }
        }

        return false;
    }

    private static function decode_bricks(string $value)
    {
        // Do not instantiate objects from stored builder metadata.
        if (! is_serialized($value)) {
            return null;
        }

        return @unserialize(trim($value), ['allowed_classes' => false]);
    }

    private static function builder_has_embed(array $elements, bool $elementor, int $depth = 0): bool
    {
        if ($depth > 32) {
            return false;
        }
        foreach ($elements as $element) {
            if (! is_array($element)) {
                continue;
            }
            $type = $element[$elementor ? 'widgetType' : 'name'] ?? '';
            $fields = $elementor
                ? ['shortcode' => 'shortcode', 'html' => 'html', 'text-editor' => 'editor']
                : ['shortcode' => 'shortcode', 'text' => 'text', 'text-basic' => 'text', 'html' => 'html'];
            $field = is_string($type) ? ($fields[$type] ?? null) : null;
            if ($field && is_string($element['settings'][$field] ?? null)
                && self::content_has_embed($element['settings'][$field])) {
                return true;
            }
            if ($elementor && is_array($element['elements'] ?? null)
                && self::builder_has_embed($element['elements'], true, $depth + 1)) {
                return true;
            }
        }

        return false;
    }

    private static function content_has_embed(string $content): bool
    {
        // Documentation/examples and script strings are not configured embed placements.
        $content = preg_replace('#<(pre|code|script|style|textarea)\b[^>]*>.*?</\1\s*>#is', '', $content) ?? '';
        if (preg_match_all('/<!--\s+wp:(?:grwi-widget|gr-widget)\/embed\s+(\{.*?\})\s*\/?-->/s', $content, $blocks)) {
            foreach ($blocks[1] as $json) {
                $attrs = json_decode($json, true);
                if (is_array($attrs) && self::valid_key($attrs['embedKey'] ?? null)) {
                    return true;
                }
            }
        }
        $content = preg_replace('/<!--.*?-->/s', '', $content) ?? '';
        if (preg_match_all('/(?<!\[)\[(?:grwi_widget|grw-widget)(?=\s|\])([^\]]*)\](?!\])/', $content, $shortcodes)) {
            foreach ($shortcodes[1] as $attrs) {
                if (preg_match('/(?:^|\s)id\s*=\s*(?:"([A-Za-z0-9_-]+)"|\x27([A-Za-z0-9_-]+)\x27|([A-Za-z0-9_-]+)(?=\s|$))/', $attrs)) {
                    return true;
                }
            }
        }
        if (preg_match_all('/<(?:div|span|section)\b[^>]*>/i', $content, $tags)) {
            foreach ($tags[0] as $tag) {
                if (preg_match('/\sclass\s*=\s*(["\x27])([^"\x27]*)\1/i', $tag, $class)
                    && in_array('grwidget-embed', preg_split('/\s+/', trim($class[2])), true)
                    && preg_match('/\sdata-grwidget-key\s*=\s*(["\x27])([A-Za-z0-9_-]+)\1/i', $tag)) {
                    return true;
                }
            }
        }
        // Divi code modules may URL-encode their saved HTML. Decode only that known field.
        if (preg_match_all('/\[et_pb_code(?:\s[^\]]*)?\](.*?)\[\/et_pb_code\]/s', $content, $modules)) {
            foreach ($modules[1] as $module) {
                $decoded = rawurldecode($module);
                if ($decoded !== $module && self::content_has_embed($decoded)) {
                    return true;
                }
            }
        }

        return false;
    }

    private static function valid_key($key): bool
    {
        return is_string($key) && preg_match('/^[A-Za-z0-9_-]+$/D', $key) === 1;
    }
}

<?php

defined('ABSPATH') || exit;

class GRWI_Shortcode
{
    public static function register(): void
    {
        add_shortcode('grwi_widget', [self::class, 'render']);
        // Deprecated pre-1.0 alias — kept so existing embeds keep working after grw_* → grwi_* migration.
        add_shortcode('grw-widget', [self::class, 'render']);
    }

    public static function content_has_widget(string $content): bool
    {
        if ($content === '') {
            return false;
        }

        return has_shortcode($content, 'grwi_widget') || has_shortcode($content, 'grw-widget');
    }

    /**
     * @param array<string, string> $atts
     */
    public static function render($atts): string
    {
        if (! GRWI_API_Client::service_allowed()) {
            return '';
        }

        $atts = shortcode_atts(['id' => ''], $atts, 'grwi_widget');
        $embed_key = sanitize_text_field($atts['id']);

        if ($embed_key === '') {
            return '';
        }

        GRWI_Embed::mark_needed();

        return '<div class="grwidget-embed" data-grwidget-key="' . esc_attr($embed_key) . '" data-grwidget-locale="' . esc_attr(GRWI_Embed::frontend_locale()) . '"></div>';
    }
}

<?php

defined('ABSPATH') || exit;

/**
 * Conditionally load grwidget.js on pages that render GR widgets.
 */
final class GRWI_Embed
{
    private static bool $needed = false;

    private static bool $hooks_registered = false;

    /**
     * True when post content, custom HTML, or a widget already includes a hosted grwidget.js tag.
     */
    private static bool $hosted_script_in_document = false;

    /** Frontend/page locale, never the logged-in administrator's preferred language. */
    public static function frontend_locale(): string
    {
        $locale = function_exists('get_locale') ? (string) get_locale() : 'en_US';
        $admin = function_exists('is_admin') && is_admin();
        if ($admin && function_exists('get_option')) {
            $locale = (string) get_option('WPLANG', 'en_US') ?: 'en_US';
        }
        if (! $admin && function_exists('pll_current_language')) {
            $locale = (string) pll_current_language('locale') ?: $locale;
        } elseif (! $admin && function_exists('apply_filters')) {
            $current = (string) apply_filters('wpml_current_language', null);
            // get_locale() is already filtered by WPML. Its full locale is more precise
            // than a matching two-letter language slug (nl must not erase nl_BE).
            $base = strtolower((string) preg_split('/[_-]/', $locale)[0]);
            if ($current !== '' && $current !== 'all'
                && (strpbrk($current, '_-') !== false || strtolower($current) !== $base)) {
                $locale = $current;
            }
        }
        if (function_exists('apply_filters')) {
            $locale = (string) apply_filters('grwi_widget_frontend_locale', $locale);
        }

        return preg_match('/^[a-zA-Z]{2,3}(?:[_-][a-zA-Z0-9]{2,8})*$/', $locale) ? $locale : 'en_US';
    }

    public static function register(): void
    {
        if (self::$hooks_registered) {
            return;
        }

        self::$hooks_registered = true;

        // Inspect only content actually rendered on this request, never stored sidebars.
        add_filter('the_content', [self::class, 'rendered_content'], 20);
        add_filter('render_block', [self::class, 'rendered_content'], 20);
        add_filter('widget_text', [self::class, 'rendered_content'], 20);
        add_filter('widget_custom_html_content', [self::class, 'rendered_content'], 20);
        add_action('wp_enqueue_scripts', [self::class, 'maybe_enqueue'], 20);
        add_filter('script_loader_tag', [self::class, 'filter_embed_tag'], 10, 3);
    }

    /**
     * Mark the current page as needing the embed script (shortcode/block render).
     */
    public static function mark_needed(): void
    {
        if (is_admin()) {
            return;
        }

        self::$needed = true;
        self::maybe_enqueue();
    }

    /** Kept for compatibility; stored content is no longer scanned. */
    public static function detect_on_page(): void
    {
    }

    /** @param string $content Rendered post, block or active widget HTML. */
    public static function rendered_content(string $content): string
    {
        if (! is_admin() && GRWI_API_Client::service_allowed()
            && strpos($content, 'grwidget-embed') !== false
            && strpos($content, 'data-grwidget-key') !== false) {
            // Custom HTML and widget-area embeds inherit the same page locale.
            if (class_exists('WP_HTML_Tag_Processor')) {
                $tags = new WP_HTML_Tag_Processor($content);
                while ($tags->next_tag()) {
                    if ($tags->get_attribute('data-grwidget-key') !== null || $tags->get_attribute('data-grwidget') !== null) {
                        $tags->set_attribute('data-grwidget-locale', self::frontend_locale());
                    }
                }
                $content = $tags->get_updated_html();
            }
            self::mark_needed();
        }

        return $content;
    }

    public static function maybe_enqueue(): void
    {
        if (is_admin() || ! GRWI_API_Client::service_allowed() || ! self::$needed) {
            return;
        }

        if (self::is_script_already_present()) {
            return;
        }

        $script = GRWI_EMBED_SCRIPT;
        if ($script === '') {
            return;
        }

        wp_enqueue_script('grwi-embed', esc_url($script), [], GRWI_VERSION, true);
    }

    /**
     * Print the hosted embed once. Skip if a theme, Custom HTML, or pasted snippet
     * already put grwidget.js in the document (header/content/footer before this tag).
     *
     * @param string $tag    Script tag HTML.
     * @param string $handle Script handle.
     * @param string $src    Script URL.
     */
    public static function filter_embed_tag(string $tag, string $handle, string $src = ''): string
    {
        if ($handle !== 'grwi-embed') {
            return $tag;
        }

        if (! GRWI_API_Client::service_allowed()) {
            return '';
        }

        $src = $src !== '' ? $src : GRWI_EMBED_SCRIPT;
        if ($src === '') {
            return '';
        }

        return sprintf(
            '<script id="grwi-embed-guard" data-wpmeteor-nooptimize="true">(function(){if(!document.querySelector(".grwidget-embed[data-grwidget-key]")){return;}if(document.querySelector("script[src*=\\"grwidget.js\\"]")){return;}var s=document.createElement("script");s.src=%s;s.async=true;s.defer=true;s.setAttribute("data-wpmeteor-nooptimize","true");document.head.appendChild(s);})();</script>' . "\n",
            wp_json_encode(esc_url($src))
        );
    }

    /**
     * @deprecated 1.1.1 Use filter_embed_tag(); kept so older tests/hooks still resolve.
     *
     * @param string $tag    Script tag HTML.
     * @param string $handle Script handle.
     */
    public static function add_async_defer(string $tag, string $handle): string
    {
        return self::filter_embed_tag($tag, $handle);
    }

    /**
     * True when a raw <script src="…grwidget.js"> is already in post content or widgets.
     */
    public static function content_has_hosted_script(string $content): bool
    {
        if ($content === '' || stripos($content, 'grwidget.js') === false) {
            return false;
        }

        if (preg_match('/<script\b[^>]*\bsrc\s*=\s*([\'"]?)[^\'"\s>]*grwidget\.js/i', $content) === 1) {
            return true;
        }

        // Escaped HTML in some page-builder stores.
        if (preg_match('/&lt;script\b[^&]*\bsrc\s*=\s*([\'"]?)[^\'">]*grwidget\.js/i', $content) === 1) {
            return true;
        }

        return false;
    }

    private static function is_script_already_present(): bool
    {
        if (self::$hosted_script_in_document) {
            return true;
        }

        if (is_singular()) {
            global $post;
            if ($post instanceof WP_Post && self::content_has_hosted_script($post->post_content)) {
                self::$hosted_script_in_document = true;

                return true;
            }
        }

        if (wp_script_is('grwi-embed', 'enqueued') || wp_script_is('grwi-embed', 'done')) {
            return true;
        }

        global $wp_scripts;
        if (! ($wp_scripts instanceof WP_Scripts)) {
            return false;
        }

        foreach ($wp_scripts->queue as $handle) {
            if (! isset($wp_scripts->registered[$handle])) {
                continue;
            }

            $src = (string) ($wp_scripts->registered[$handle]->src ?? '');
            if ($src !== '' && strpos($src, 'grwidget.js') !== false) {
                return true;
            }
        }

        return false;
    }

}

<?php

defined('ABSPATH') || exit;

$grwi_check_home = home_url('/');
$grwi_check_widgets = [];
foreach ($widgets as $grwi_check_widget) {
    if (! is_array($grwi_check_widget)) {
        continue;
    }
    $grwi_check_key = sanitize_text_field((string) ($grwi_check_widget['embed_key'] ?? ''));
    if ($grwi_check_key === '') {
        continue;
    }
    $grwi_check_name = sanitize_text_field((string) ($grwi_check_widget['name'] ?? ''));
    if ($grwi_check_name === '') {
        $grwi_check_name = $grwi_check_key;
    }
    $grwi_check_widgets[] = [
        'embed_key' => $grwi_check_key,
        'name' => $grwi_check_name,
    ];
}
if ($grwi_check_widgets === []) {
    return;
}
?>
<section class="grw-install-check" id="grwi-install-check" aria-labelledby="grwi-install-check-heading">
    <h3 class="grw-install-check__title" id="grwi-install-check-heading"><?php esc_html_e('Check if a widget is live', 'gr-widget'); ?></h3>
    <p class="grw-install-check__lead"><?php esc_html_e('Enter a public page on this site. We look for that widget’s block, shortcode, embed, or rendered markup.', 'gr-widget'); ?></p>
    <div class="grw-install-check__field">
        <label for="grwi-install-check-widget"><?php esc_html_e('Widget', 'gr-widget'); ?></label>
        <select id="grwi-install-check-widget" data-grwi-install-check-widget>
            <?php foreach ($grwi_check_widgets as $grwi_check_option) : ?>
                <option value="<?php echo esc_attr($grwi_check_option['embed_key']); ?>"><?php echo esc_html($grwi_check_option['name']); ?></option>
            <?php endforeach; ?>
        </select>
    </div>
    <div class="grw-install-check__field">
        <label for="grwi-install-check-url"><?php esc_html_e('Page address', 'gr-widget'); ?></label>
        <input
            type="url"
            id="grwi-install-check-url"
            inputmode="url"
            autocomplete="url"
            value="<?php echo esc_attr($grwi_check_home); ?>"
            data-grwi-install-check-url
            aria-describedby="grwi-install-check-error"
        />
    </div>
    <div class="grw-install-check__field">
        <label for="grwi-install-check-platform"><?php esc_html_e('Where you added it', 'gr-widget'); ?></label>
        <select id="grwi-install-check-platform" data-grwi-install-check-platform>
            <option value="wordpress_block"><?php esc_html_e('WordPress block', 'gr-widget'); ?></option>
            <option value="wordpress_shortcode"><?php esc_html_e('WordPress shortcode', 'gr-widget'); ?></option>
            <option value="elementor"><?php esc_html_e('Elementor', 'gr-widget'); ?></option>
            <option value="divi"><?php esc_html_e('Divi', 'gr-widget'); ?></option>
            <option value="bricks"><?php esc_html_e('Bricks', 'gr-widget'); ?></option>
        </select>
    </div>
    <button type="button" class="button button-primary grw-install-check__submit" data-grwi-install-check-submit><?php esc_html_e('Check this page', 'gr-widget'); ?></button>
    <p class="grw-install-check__error" id="grwi-install-check-error" data-grwi-install-check-error hidden></p>
    <div class="grw-install-check__status" data-grwi-install-check-status hidden aria-live="polite"></div>
</section>

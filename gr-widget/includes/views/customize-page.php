<?php

defined('ABSPATH') || exit;

/** Native widget customize screen (included from GRWI_Customize). */

$grwi_embed_key = sanitize_text_field($widget['embed_key'] ?? '');
$grwi_business_name = sanitize_text_field($widget['business_name'] ?? ($widget['name'] ?? ''));
$grwi_layout_key = sanitize_key($layout_key ?? ($widget['layout'] ?? ($config['layout'] ?? 'badge_card')));
$grwi_shortcode = sanitize_text_field($widget['shortcode'] ?? ('[grwi_widget id="' . $grwi_embed_key . '"]'));
$grwi_embed_snippet = (string) ($widget['embed_snippet'] ?? '');
$grwi_builder = is_array($editor['builder'] ?? null) ? $editor['builder'] : [];
$grwi_sections = is_array($grwi_builder['sections'] ?? null) ? $grwi_builder['sections'] : [];
$grwi_active_section = sanitize_key($grwi_active_section ?? '');
if ($grwi_active_section === '') {
    $grwi_active_section = 'style';
}
$grwi_created = ! empty($grwi_created);

/** Outlined 24×24 SVG path `d` values (Heroicons-style), keyed by section id. */
$grwi_rail_svgs = [
    'layout' => 'M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z',
    'options' => 'M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5',
    'style' => 'M9.53 16.122a3 3 0 0 0-5.78 1.128 2.25 2.25 0 0 1-2.4 2.245 4.5 4.5 0 0 0 8.4-2.245c0-.399-.078-.78-.22-1.128Zm0 0a15.998 15.998 0 0 0 6.697 12.9c.75.75 1.95.22 1.72-1.062a11.044 11.044 0 0 1 .085-3.977M9.53 16.122l-7.19 3.75a2.25 2.25 0 0 1-2.4-2.245l7.19-3.75m0 0a15.998 15.998 0 0 1 6.697-12.9 2.25 2.25 0 0 1 2.4 2.245 11.044 11.044 0 0 0-.085 3.977',
    'reviews' => 'M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.563.563 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z',
    'customize' => 'M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0ZM3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75',
    'ai-summary' => 'M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z',
    'panel' => 'M3.75 4.5A.75.75 0 0 1 4.5 3.75h15a.75.75 0 0 1 .75.75v15a.75.75 0 0 1-.75.75h-15a.75.75 0 0 1-.75-.75v-15ZM9 3.75v16.5',
    'settings' => 'M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 0 1 0 .255c-.007.378.138.75.43.99l1.005.828c.447.368.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 0 1 0-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281Z M12 15.75a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5Z',
    'install' => 'M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5',
];
$grwi_help_svg = 'M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z';
$grwi_layout_label = sanitize_text_field((string) ($layout_label ?? ''));
$grwi_editing_subtitle = $grwi_layout_label !== ''
    ? sprintf(
        /* translators: %s: layout label (e.g. Rating Badge) */
        __('%s · Editing', 'gr-widget'),
        $grwi_layout_label
    )
    : __('Editing', 'gr-widget');

$grwi_section_display_title = static function ($section_id, $title) {
    $title = (string) $title;
    if ($section_id === 'panel' && ($title === '' || $title === 'Panel')) {
        return __('Review Panel', 'gr-widget');
    }
    if ($section_id === 'ai-summary' && ($title === '' || $title === 'AI Summary')) {
        return __('AI Features', 'gr-widget');
    }
    return $title !== '' ? $title : ucfirst((string) $section_id);
};
?>
<div class="wrap grw-admin grw-customize" data-embed-key="<?php echo esc_attr($grwi_embed_key); ?>" data-layout="<?php echo esc_attr($grwi_layout_key); ?>" data-grwi-active-section="<?php echo esc_attr($grwi_active_section); ?>">
    <div id="grwi-customize-notices" class="grw-admin-notices" aria-live="polite">
        <?php if ($grwi_created) : ?>
            <div class="grw-toast grw-toast--success" data-grwi-toast data-grwi-toast-autodismiss="4500" role="status">
                <span class="dashicons dashicons-yes-alt grw-toast__icon" aria-hidden="true"></span>
                <p class="grw-toast__text"><?php esc_html_e('Widget created successfully.', 'gr-widget'); ?></p>
                <button type="button" class="grw-toast__dismiss" data-grwi-toast-dismiss aria-label="<?php esc_attr_e('Dismiss', 'gr-widget'); ?>">&times;</button>
            </div>
        <?php endif; ?>
    </div>

    <header class="grw-customize__topbar">
        <div class="grw-customize__topbar-left">
            <a class="grw-customize__back-btn" href="<?php echo esc_url(GRWI_Admin::admin_page_url()); ?>" aria-label="<?php esc_attr_e('All widgets', 'gr-widget'); ?>">
                <svg class="grw-customize__back-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5"/>
                </svg>
            </a>
            <a class="grw-customize__back-label" href="<?php echo esc_url(GRWI_Admin::admin_page_url()); ?>">
                <?php esc_html_e('All widgets', 'gr-widget'); ?>
            </a>
            <span class="grw-customize__divider" aria-hidden="true"></span>
            <div class="grw-customize__title-wrap">
                <h1 class="grw-customize__title"><?php echo esc_html($grwi_business_name); ?></h1>
                <p class="grw-customize__subtitle"><?php echo esc_html($grwi_editing_subtitle); ?></p>
            </div>
        </div>
        <div class="grw-customize__topbar-actions">
            <span class="grw-customize__status" id="grwi-customize-status" data-state="saved" role="status" aria-live="polite">
                <span class="grw-customize__status-icon" aria-hidden="true">
                    <svg class="grw-customize__status-check" viewBox="0 0 24 24" fill="none">
                        <path stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5"/>
                    </svg>
                    <span class="grw-customize__status-spinner"></span>
                </span>
                <span class="grw-customize__status-text"><?php esc_html_e('Saved', 'gr-widget'); ?></span>
            </span>
            <button type="button" class="grw-customize__install-btn" id="grwi-install-widget" data-grwi-install-open title="<?php esc_attr_e('Install widget', 'gr-widget'); ?>">
                <svg class="grw-customize__install-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5"/>
                </svg>
                <span class="grw-customize__install-btn__label"><?php esc_html_e('Install widget', 'gr-widget'); ?></span>
            </button>
            <button type="button" class="grw-customize__save-btn" id="grwi-customize-save">
                <?php echo ! empty($grwi_preview_first) ? esc_html__('Save draft', 'gr-widget') : esc_html__('Save changes', 'gr-widget'); ?>
            </button>
            <?php if (! empty($grwi_preview_first)) : ?>
                <button type="button" class="grw-customize__save-btn grw-customize__save-btn--primary" id="grwi-customize-publish">
                    <?php esc_html_e('Publish changes', 'gr-widget'); ?>
                </button>
            <?php endif; ?>
        </div>
    </header>

    <div id="grwi-builder-notice" class="grwi-builder-notice" hidden></div>

    <div class="grw-customize__shell">
        <div class="grw-customize__workspace">
            <nav class="grw-customize__rail" aria-label="<?php esc_attr_e('Widget editor sections', 'gr-widget'); ?>" id="grwi-customize-rail" role="tablist" aria-orientation="vertical">
                <?php foreach ($grwi_sections as $grwi_index => $grwi_section) : ?>
                    <?php
                    $grwi_section_id = sanitize_key($grwi_section['id'] ?? '');
                    if ($grwi_section_id === '') {
                        continue;
                    }
                    $grwi_is_active = $grwi_section_id === $grwi_active_section;
                    $grwi_svg_d = $grwi_rail_svgs[$grwi_section_id] ?? $grwi_rail_svgs['options'];
                    $grwi_tab_id = 'grwi-tab-' . $grwi_section_id;
                    $grwi_panel_id = 'grwi-panel-' . $grwi_section_id;
                    $grwi_section_title = $grwi_section_display_title($grwi_section_id, $grwi_section['title'] ?? '');
                    ?>
                    <button
                        type="button"
                        role="tab"
                        id="<?php echo esc_attr($grwi_tab_id); ?>"
                        class="grw-customize__rail-btn<?php echo $grwi_is_active ? ' is-active' : ''; ?>"
                        data-grwi-section="<?php echo esc_attr($grwi_section_id); ?>"
                        aria-selected="<?php echo $grwi_is_active ? 'true' : 'false'; ?>"
                        aria-controls="<?php echo esc_attr($grwi_panel_id); ?>"
                        tabindex="<?php echo $grwi_is_active ? '0' : '-1'; ?>"
                        <?php echo ! empty($grwi_section['locked']) ? ' data-grwi-locked="1"' : ''; ?>
                    >
                        <svg class="grw-customize__rail-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="<?php echo esc_attr($grwi_svg_d); ?>"/>
                        </svg>
                        <span class="grw-customize__rail-label"><?php echo esc_html($grwi_section_title); ?></span>
                        <?php if (! empty($grwi_section['locked'])) : ?>
                            <span class="dashicons dashicons-lock grw-customize__rail-lock" aria-hidden="true"></span>
                        <?php endif; ?>
                    </button>
                <?php endforeach; ?>
                <div class="grw-customize__rail-footer">
                    <button
                        type="button"
                        class="grw-customize__rail-help"
                        data-grwi-bug-report-open
                        title="<?php esc_attr_e('Help & feedback', 'gr-widget'); ?>"
                    >
                        <svg class="grw-customize__rail-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="<?php echo esc_attr($grwi_help_svg); ?>"/>
                        </svg>
                        <span class="grw-customize__rail-label"><?php esc_html_e('Help & feedback', 'gr-widget'); ?></span>
                    </button>
                </div>
            </nav>

            <div class="grw-customize__panel" id="grwi-customize-panels">
                <?php foreach ($grwi_sections as $grwi_index => $grwi_section) : ?>
                    <?php
                    $grwi_section_id = sanitize_key($grwi_section['id'] ?? '');
                    if ($grwi_section_id === '') {
                        continue;
                    }
                    $grwi_is_active = $grwi_section_id === $grwi_active_section;
                    $grwi_tab_id = 'grwi-tab-' . $grwi_section_id;
                    $grwi_panel_id = 'grwi-panel-' . $grwi_section_id;
                    $grwi_section_title = $grwi_section_display_title($grwi_section_id, $grwi_section['title'] ?? '');
                    ?>
                    <section
                        class="grw-customize__section<?php echo $grwi_is_active ? ' is-active' : ''; ?>"
                        id="<?php echo esc_attr($grwi_panel_id); ?>"
                        role="tabpanel"
                        aria-labelledby="<?php echo esc_attr($grwi_tab_id); ?>"
                        data-grwi-panel="<?php echo esc_attr($grwi_section_id); ?>"
                        <?php echo $grwi_is_active ? '' : ' hidden'; ?>
                    >
                        <header class="grw-customize__section-head">
                            <h2 class="grw-panel__title"><?php echo esc_html($grwi_section_title); ?></h2>
                            <?php if (! empty($grwi_section['subtitle'])) : ?>
                                <p class="grw-panel__subtitle"><?php echo esc_html($grwi_section['subtitle']); ?></p>
                            <?php endif; ?>
                        </header>
                        <div class="grw-customize__section-body" data-grwi-section-body="<?php echo esc_attr($grwi_section_id); ?>"></div>
                    </section>
                <?php endforeach; ?>
            </div>
        </div>

        <aside class="grw-customize__canvas" aria-label="<?php esc_attr_e('Live preview', 'gr-widget'); ?>">
            <div class="grw-live-preview__head">
                <h2 class="grw-live-preview__title"><?php esc_html_e('Live preview', 'gr-widget'); ?></h2>
                <p class="grw-live-preview__sub" id="grwi-customize-preview-sub"><?php esc_html_e('Showing your synced Google reviews.', 'gr-widget'); ?></p>
            </div>
            <?php
            $grwi_live_preview = is_array($editor['live_preview'] ?? null) ? $editor['live_preview'] : null;
            $grwi_live_preview_embed = is_array($grwi_live_preview) && ! empty($grwi_live_preview['embed']);
            ?>
            <?php if ($grwi_live_preview_embed) : ?>
                <div
                    class="grwi-live-draft-switch"
                    id="grwi-live-draft-switch"
                    role="group"
                    aria-label="<?php esc_attr_e('Preview draft or live widget', 'gr-widget'); ?>"
                    data-grwi-live-draft="<?php echo ! empty($grwi_live_preview['show_toggle']) ? 'shown' : 'available'; ?>"
                    data-plan-name="<?php echo esc_attr((string) ($grwi_live_preview['plan_name'] ?? 'Free')); ?>"
                    <?php echo empty($grwi_live_preview['show_toggle']) ? 'hidden' : ''; ?>
                >
                    <button type="button" class="is-active" data-grwi-preview-mode="draft" aria-pressed="true"><?php esc_html_e('Draft', 'gr-widget'); ?></button>
                    <button type="button" data-grwi-preview-mode="live" aria-pressed="false"><?php echo esc_html((string) ($grwi_live_preview['live_label'] ?? 'Live')); ?></button>
                </div>
                <p class="grwi-live-draft-context" id="grwi-live-draft-context" <?php echo empty($grwi_live_preview['show_toggle']) ? 'hidden' : ''; ?>>
                    <span id="grwi-live-draft-context-text"><?php echo esc_html((string) ($grwi_live_preview['context'] ?? '')); ?></span>
                    <?php if (! empty($grwi_live_preview['action_label'])) : ?>
                        <a class="button button-primary" id="grwi-live-draft-action" href="<?php echo esc_url((string) $grwi_live_preview['action_href']); ?>" target="_blank" rel="noopener noreferrer"><?php echo esc_html((string) $grwi_live_preview['action_label']); ?></a>
                    <?php else : ?>
                        <a class="button button-primary" id="grwi-live-draft-action" href="#" target="_blank" rel="noopener noreferrer" hidden></a>
                    <?php endif; ?>
                </p>
            <?php endif; ?>
            <p class="grwi-live-draft-lock" id="grwi-live-draft-lock" hidden><?php esc_html_e('Switch to Draft to edit', 'gr-widget'); ?></p>
            <?php if (! empty($grwi_preview_first)) : ?>
                <div id="grwi-preview-first-banner" class="grw-preview-first-banner" hidden>
                    <p id="grwi-preview-first-banner-title" class="grw-preview-first-banner__title"></p>
                    <p id="grwi-preview-first-banner-body" class="grw-preview-first-banner__body"></p>
                    <div class="grw-preview-first-banner__actions">
                        <a href="#" class="button button-primary" id="grwi-preview-first-banner-trial"><?php esc_html_e('Start Site free trial', 'gr-widget'); ?></a>
                        <a href="#" class="button" id="grwi-preview-first-banner-features"><?php esc_html_e('View included features', 'gr-widget'); ?></a>
                    </div>
                </div>
                <div id="grwi-preview-first-toast" class="grw-preview-first-toast" hidden role="status" aria-live="polite">
                    <div class="grw-preview-first-toast__inner">
                        <div>
                            <p id="grwi-preview-first-toast-title" class="grw-preview-first-toast__title"></p>
                            <p id="grwi-preview-first-toast-body" class="grw-preview-first-toast__body"></p>
                            <div id="grwi-preview-first-toast-actions" class="grw-preview-first-toast__actions" hidden>
                                <a class="button button-primary" id="grwi-preview-first-toast-cta" hidden><?php esc_html_e('Upgrade to Site', 'gr-widget'); ?></a>
                                <button type="button" class="button" id="grwi-preview-first-toast-undo" hidden><?php esc_html_e('Undo', 'gr-widget'); ?></button>
                            </div>
                        </div>
                        <button type="button" class="grw-preview-first-toast__close" data-grwi-toast-close aria-label="<?php esc_attr_e('Dismiss', 'gr-widget'); ?>">&times;</button>
                    </div>
                </div>
            <?php endif; ?>
            <div class="grw-live-preview__stage grw-customize__preview-stage">
                <div class="grw-customize__preview-root wb-preview-root" data-grwi-preview-root data-wb-preview-root>
                    <div id="grwi-customize-preview-mount" class="grw-live-preview__target" data-wb-builder-preview></div>
                </div>
            </div>
        </aside>
    </div>


    <script type="application/json" id="grwi-customize-editor"><?php echo wp_json_encode($editor, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT); ?></script>

    <div id="grwi-install-modal" class="grw-bug-modal grw-install-modal" hidden role="dialog" aria-modal="true" aria-labelledby="grwi-install-modal-title">
        <div class="grw-bug-modal__backdrop" data-grwi-install-close tabindex="-1" aria-hidden="true"></div>
        <div class="grw-bug-modal__panel grw-install-modal__panel">
            <div class="grw-install-modal__head">
                <h2 id="grwi-install-modal-title" class="grw-bug-modal__title"><?php esc_html_e('Install widget', 'gr-widget'); ?></h2>
                <button type="button" class="grw-install-modal__close" data-grwi-install-close aria-label="<?php esc_attr_e('Close', 'gr-widget'); ?>">&times;</button>
            </div>
            <p class="grw-bug-modal__text"><?php esc_html_e('Paste the shortcode into a GR Widget block or any shortcode field. The plugin loads the embed script automatically.', 'gr-widget'); ?></p>
            <div class="grw-install-modal__body">
                <label class="grw-bug-modal__label" for="grwi-install-shortcode">
                    <span><?php esc_html_e('WordPress shortcode', 'gr-widget'); ?></span>
                </label>
                <div class="grw-shortcode-field">
                    <input type="text" id="grwi-install-shortcode" class="grw-shortcode-input" readonly value="<?php echo esc_attr($grwi_shortcode); ?>" />
                    <button type="button" class="button button-small grw-copy-btn grw-copy-btn--install" data-copy="<?php echo esc_attr($grwi_shortcode); ?>">
                        <?php esc_html_e('Copy', 'gr-widget'); ?>
                    </button>
                </div>
                <?php
                $grwi_embed_without_script = trim(preg_replace(
                    '/<script\b[^>]*\bsrc=(["\'])[^"\']*grwidget\.js[^"\']*\1[^>]*>\s*<\/script>\s*/i',
                    '',
                    $grwi_embed_snippet
                ) ?? '');
                ?>
                <?php if ($grwi_embed_without_script !== '') : ?>
                    <label class="grw-bug-modal__label" for="grwi-install-embed">
                        <span><?php esc_html_e('HTML embed', 'gr-widget'); ?></span>
                    </label>
                    <div class="grw-embed-snippet-wrap">
                        <textarea id="grwi-install-embed" class="grw-embed-snippet" readonly rows="4"><?php echo esc_textarea($grwi_embed_without_script); ?></textarea>
                        <button type="button" class="button button-small grw-copy-btn grw-copy-btn--install" data-copy="<?php echo esc_attr($grwi_embed_without_script); ?>">
                            <?php esc_html_e('Copy', 'gr-widget'); ?>
                        </button>
                    </div>
                    <p class="grw-field__hint"><?php esc_html_e('For Custom HTML blocks or templates, paste only this container markup. Do not add a script tag.', 'gr-widget'); ?></p>
                <?php endif; ?>
            </div>
            <div class="grw-bug-modal__actions">
                <button type="button" class="button button-primary" data-grwi-install-close><?php esc_html_e('Done', 'gr-widget'); ?></button>
            </div>
        </div>
    </div>

    <div
        id="grwi-unlock-modal"
        class="grw-unlock-modal"
        hidden
        role="dialog"
        aria-modal="true"
        aria-labelledby="grwi-unlock-modal-title"
    >
        <div class="grw-unlock-modal__backdrop" data-grw-unlock-close tabindex="-1" aria-hidden="true"></div>
        <div class="grw-unlock-modal__panel" role="document">
            <button type="button" class="grw-unlock-modal__close" data-grw-unlock-close aria-label="<?php esc_attr_e('Close', 'gr-widget'); ?>">
                &times;
            </button>
            <h2 id="grwi-unlock-modal-title" class="grw-unlock-modal__title"></h2>
            <p class="grw-unlock-modal__body" id="grwi-unlock-modal-body"></p>
            <p class="grw-unlock-modal__supporting" id="grwi-unlock-modal-supporting" hidden></p>
            <div class="grw-unlock-modal__actions">
                <button type="button" class="button button-primary grw-unlock-modal__primary" id="grwi-unlock-modal-primary"></button>
                <button type="button" class="button button-secondary" id="grwi-unlock-modal-plan-safe" hidden></button>
                <button type="button" class="button button-secondary grw-unlock-modal__secondary" id="grwi-unlock-modal-secondary"></button>
            </div>
            <p class="grw-unlock-modal__footer" id="grwi-unlock-modal-footer" hidden></p>
            <p class="grw-unlock-modal__note" id="grwi-unlock-modal-note" hidden></p>
            <button type="button" class="button-link grw-unlock-modal__link-only" id="grwi-unlock-modal-link-only" hidden></button>
        </div>
    </div>

    <div id="grwi-bug-report-modal" class="grw-bug-modal" hidden role="dialog" aria-modal="true" aria-labelledby="grwi-bug-report-title">
        <div class="grw-bug-modal__backdrop" data-grwi-bug-close tabindex="-1" aria-hidden="true"></div>
        <div class="grw-bug-modal__panel">
            <h2 id="grwi-bug-report-title" class="grw-bug-modal__title"><?php esc_html_e('Report a bug', 'gr-widget'); ?></h2>
            <p class="grw-bug-modal__text"><?php esc_html_e('Describe what went wrong. We include your widget key and builder section when possible.', 'gr-widget'); ?></p>
            <form class="grw-bug-modal__form" id="grwi-bug-report-form">
                <input type="hidden" name="context" value="" data-grwi-bug-context>
                <label class="grw-bug-modal__label">
                    <span><?php esc_html_e('What happened?', 'gr-widget'); ?> <span class="grw-bug-modal__req">*</span></span>
                    <textarea name="description" class="grw-bug-modal__textarea" rows="5" required maxlength="5000" placeholder="<?php esc_attr_e('Steps to reproduce, what you expected, and what you saw instead…', 'gr-widget'); ?>"></textarea>
                </label>
                <label class="grw-bug-modal__label">
                    <span><?php esc_html_e('Email', 'gr-widget'); ?> <span class="grw-bug-modal__req">*</span></span>
                    <input type="email" name="email" class="grw-bug-modal__input" required maxlength="255" placeholder="you@company.com" value="<?php echo esc_attr((string) wp_get_current_user()->user_email); ?>">
                </label>
                <p class="grw-bug-modal__status" id="grwi-bug-report-status" hidden></p>
                <div class="grw-bug-modal__actions">
                    <button type="button" class="button" data-grwi-bug-close><?php esc_html_e('Cancel', 'gr-widget'); ?></button>
                    <button type="submit" class="button button-primary" id="grwi-bug-report-submit"><?php esc_html_e('Send report', 'gr-widget'); ?></button>
                </div>
            </form>
        </div>
    </div>

    <div
        id="grwi-leave-unsaved-modal"
        class="grw-confirm-modal"
        hidden
        role="dialog"
        aria-modal="true"
        aria-labelledby="grwi-leave-unsaved-title"
        aria-describedby="grwi-leave-unsaved-body"
    >
        <div class="grw-confirm-modal__backdrop" data-grwi-leave-close tabindex="-1" aria-hidden="true"></div>
        <div class="grw-confirm-modal__panel" role="document">
            <h2 id="grwi-leave-unsaved-title" class="grw-confirm-modal__title"><?php esc_html_e('Unsaved changes', 'gr-widget'); ?></h2>
            <p id="grwi-leave-unsaved-body" class="grw-confirm-modal__body"><?php esc_html_e('You have unsaved changes. Save before leaving, or discard them.', 'gr-widget'); ?></p>
            <div class="grw-confirm-modal__actions grw-confirm-modal__actions--leave">
                <button type="button" class="grw-confirm-modal__btn grw-confirm-modal__btn--discard" id="grwi-leave-discard">
                    <?php esc_html_e('Leave without saving', 'gr-widget'); ?>
                </button>
                <button type="button" class="grw-confirm-modal__btn grw-confirm-modal__btn--cancel" data-grwi-leave-close>
                    <?php esc_html_e('Cancel', 'gr-widget'); ?>
                </button>
                <button type="button" class="grw-confirm-modal__btn grw-confirm-modal__btn--primary" id="grwi-leave-save">
                    <?php esc_html_e('Save & leave', 'gr-widget'); ?>
                </button>
            </div>
        </div>
    </div>
</div>

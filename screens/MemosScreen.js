import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { COLORS, FONTS } from '../styles/theme';

const SUPPORT_EMAIL = 'genieassists@gmail.com';
const INTERNAL_FILTERS = [
  ['all', 'All Memos'], ['urgent', '🔥 Urgent'], ['important', '⚠ Important'],
  ['policy', '⚖ Policy Updates'], ['holiday', '▣ Holidays'],
];
const NEWS_FILTERS = [
  ['all', 'All Updates'], ['gov', '🏛 Government'], ['industry', '🏭 Industry'], ['logistics', '🚚 Logistics'],
];

const safeArray = (value) => {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') {
    try { const parsed = JSON.parse(value); if (Array.isArray(parsed)) return parsed.map(String); } catch (_) {}
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return [];
};

const normalizeMemo = (raw, index) => ({
  ...raw,
  id: String(raw?.id || raw?.ID || raw?.MEMO_ID || raw?.REFERENCE || `MEMO-${index + 1}`),
  title: String(raw?.title || raw?.TITLE || 'Untitled memo'),
  content: String(raw?.content || raw?.CONTENT || raw?.message || raw?.MESSAGE || ''),
  author: String(raw?.author || raw?.AUTHOR || raw?.authorName || 'Company'),
  authorEmail: String(raw?.authorEmail || raw?.AUTHOR_EMAIL || ''),
  date: raw?.date || raw?.DATE || raw?.created || raw?.CREATED || new Date().toISOString(),
  priority: String(raw?.priority || raw?.PRIORITY || 'low').toLowerCase(),
  category: String(raw?.category || raw?.CATEGORY || 'general').toLowerCase(),
  status: String(raw?.status || raw?.STATUS || 'active'),
  readBy: safeArray(raw?.readBy || raw?.READ_BY),
  requiresAck: raw?.requiresAck === true || String(raw?.requiresAck || raw?.REQUIRES_ACK).toLowerCase() === 'yes' || String(raw?.REQUIRES_ACK).toLowerCase() === 'true',
  tags: safeArray(raw?.tags || raw?.TAGS),
});

const normalizeNews = (raw, index) => ({
  ...raw,
  id: String(raw?.id || raw?.ID || index),
  title: String(raw?.title || raw?.TITLE || 'Untitled update'),
  content: String(raw?.content || raw?.CONTENT || ''),
  source: String(raw?.source || raw?.SOURCE || 'External source'),
  sourceType: String(raw?.sourceType || raw?.SOURCE_TYPE || 'industry').toLowerCase(),
  date: raw?.date || raw?.DATE || new Date().toISOString(),
  importance: String(raw?.importance || raw?.IMPORTANCE || 'normal').toLowerCase(),
  tags: safeArray(raw?.tags || raw?.TAGS),
  url: raw?.url || raw?.URL || '',
});

const formatDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || '');
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const formatDateTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || '');
  return date.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const sortByDate = (items, newestFirst) => [...items].sort((a, b) => {
  const left = new Date(a.date).getTime() || 0;
  const right = new Date(b.date).getTime() || 0;
  return newestFirst ? right - left : left - right;
});

function Chip({ label, active, onPress, tone = 'red' }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.chip, active && (tone === 'green' ? styles.greenChipActive : styles.chipActive)]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function Stat({ label, value, color }) {
  return <View style={styles.statRow}><Text style={styles.statLabel}>{label}</Text><Text style={[styles.statValue, color && { color }]}>{value}</Text></View>;
}

export default function MemosScreen({ token = '', apiBase = '', user = {} }) {
  const [tab, setTab] = useState('internal');
  const [memos, setMemos] = useState([]);
  const [news, setNews] = useState([]);
  const [internalFilter, setInternalFilter] = useState('all');
  const [newsFilter, setNewsFilter] = useState('all');
  const [memoSearch, setMemoSearch] = useState('');
  const [newsSearch, setNewsSearch] = useState('');
  const [memoNewestFirst, setMemoNewestFirst] = useState(true);
  const [newsNewestFirst, setNewsNewestFirst] = useState(true);
  const [memoVisibleCount, setMemoVisibleCount] = useState(10);
  const [newsVisibleCount, setNewsVisibleCount] = useState(10);
  const [loadingMemos, setLoadingMemos] = useState(true);
  const [loadingNews, setLoadingNews] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [newsError, setNewsError] = useState('');
  const [selectedMemo, setSelectedMemo] = useState(null);
  const [composeVisible, setComposeVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [form, setForm] = useState({ title: '', priority: 'low', category: 'general', requiresAck: false, content: '' });
  const newsLoadedRef = useRef(false);
  const autoRefreshRef = useRef(null);

  const isAdmin = ['ADMIN', 'MASTER', 'MANAGER'].includes(String(user?.ROLE || '').toUpperCase());
  const userEmail = String(user?.EMAIL || (user?.USER ? `${user.USER}@postman.com` : 'guest@postman.com'));
  const appName = 'Genie';

  const requestAction = useCallback(async (action, payload = {}) => {
    const response = await fetch(`${apiBase}/api/${action}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok || json.status === 'error') throw new Error(json.message || json.detail || `Request failed (${response.status})`);
    return json;
  }, [apiBase, token]);

  const loadMemos = useCallback(async (quiet = false) => {
    if (!quiet) setLoadingMemos(true);
    setError('');
    try {
      const action = token ? 'getMemos' : 'getPublicMemos';
      const response = await requestAction(action);
      if (response.status !== 'success') throw new Error(response.message || 'Failed to load memos');
      const data = Array.isArray(response.data) ? response.data : Object.values(response.data || {});
      setMemos(data.map(normalizeMemo));
    } catch (e) {
      setError(e.message || 'Network error. Could not reach server.');
    } finally {
      setLoadingMemos(false);
    }
  }, [requestAction, token]);

  const loadNews = useCallback(async (quiet = false) => {
    if (!quiet) setLoadingNews(true);
    setNewsError('');
    try {
      const response = await requestAction('getExternalNews');
      if (response.status !== 'success') throw new Error(response.message || 'Failed to load updates');
      const data = Array.isArray(response.data) ? response.data : Object.values(response.data || {});
      setNews(data.map(normalizeNews));
      newsLoadedRef.current = true;
    } catch (e) {
      setNewsError(e.message || 'Network error. Could not reach server.');
    } finally {
      setLoadingNews(false);
    }
  }, [requestAction]);

  useEffect(() => { loadMemos(); }, [loadMemos]);

  useEffect(() => {
    if (tab === 'external' && !newsLoadedRef.current) loadNews();
  }, [loadNews, tab]);

  useEffect(() => {
    if (autoRefresh) {
      autoRefreshRef.current = setInterval(() => loadNews(true), 30 * 60 * 1000);
    } else if (autoRefreshRef.current) {
      clearInterval(autoRefreshRef.current);
      autoRefreshRef.current = null;
    }
    return () => { if (autoRefreshRef.current) clearInterval(autoRefreshRef.current); };
  }, [autoRefresh, loadNews]);

  const filteredMemos = useMemo(() => {
    const term = memoSearch.trim().toLowerCase();
    const filtered = memos.filter((memo) => {
      const filterMatch = internalFilter === 'all'
        || (internalFilter === 'urgent' && memo.priority === 'urgent')
        || (internalFilter === 'important' && memo.priority === 'high')
        || (internalFilter === 'policy' && memo.category === 'policy')
        || (internalFilter === 'holiday' && memo.category === 'holiday');
      if (!filterMatch) return false;
      if (!term) return true;
      return [memo.title, memo.content, memo.author, ...memo.tags].some((value) => String(value).toLowerCase().includes(term));
    });
    return sortByDate(filtered, memoNewestFirst);
  }, [internalFilter, memoNewestFirst, memoSearch, memos]);

  const filteredNews = useMemo(() => {
    const term = newsSearch.trim().toLowerCase();
    const filtered = news.filter((item) => {
      if (newsFilter !== 'all' && item.sourceType !== newsFilter) return false;
      if (!term) return true;
      return [item.title, item.content, item.source, ...item.tags].some((value) => String(value).toLowerCase().includes(term));
    });
    return sortByDate(filtered, newsNewestFirst);
  }, [news, newsFilter, newsNewestFirst, newsSearch]);

  const unreadMemos = memos.filter((memo) => !memo.readBy.includes(userEmail));
  const actionRequired = unreadMemos.filter((memo) => memo.requiresAck);
  const thisMonth = memos.filter((memo) => {
    const date = new Date(memo.date); const now = new Date();
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  });
  const counts = {
    gov: news.filter((item) => item.sourceType === 'gov').length,
    industry: news.filter((item) => item.sourceType === 'industry').length,
    logistics: news.filter((item) => item.sourceType === 'logistics').length,
  };

  const markRead = async (memo) => {
    if (!memo || memo.readBy.includes(userEmail)) return;
    const nextReadBy = [...memo.readBy, userEmail];
    setMemos((current) => current.map((item) => item.id === memo.id ? { ...item, readBy: nextReadBy } : item));
    setSelectedMemo((current) => current?.id === memo.id ? { ...current, readBy: nextReadBy } : current);
    // The web intentionally updates the local state immediately and syncs fbWrite
    // in the background, so a temporary write failure does not hide the memo.
    requestAction('fbWrite', {
      path: `MEMOS/PRIVATE/${memo.id}/readBy`, data: JSON.stringify(nextReadBy), method: 'PUT',
    }).catch(() => {});
  };

  const deleteMemo = (memo) => {
    if (!memo || !isAdmin) return;
    Alert.alert('Delete memo', `Delete “${memo.title}”? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await requestAction('fbWrite', { path: `MEMOS/PRIVATE/${memo.id}`, method: 'DELETE' });
          setMemos((current) => current.filter((item) => item.id !== memo.id));
          setSelectedMemo(null);
        } catch (e) { Alert.alert('Delete failed', e.message); }
      } },
    ]);
  };

  const replyToMemo = async (memo) => {
    if (!memo) return;
    const subject = encodeURIComponent(`Re: Memo ${memo.id} - ${memo.title}`);
    const body = encodeURIComponent(`\n\n---\nReplying to memo: ${memo.id}\nOriginal title: ${memo.title}\nAuthor: ${memo.author}\nDate: ${formatDate(memo.date)}\n\nMy response:`);
    const url = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
    try { await Linking.openURL(url); } catch (_) { Alert.alert('Reply unavailable', `Please email ${SUPPORT_EMAIL}.`); }
  };

  const shareMemo = async (memo) => {
    if (!memo) return;
    const text = [`MEMO: ${memo.id}`, `TITLE: ${memo.title}`, `DATE: ${formatDate(memo.date)}`, `PRIORITY: ${memo.priority.toUpperCase()}`, `CATEGORY: ${memo.category.toUpperCase()}`, `STATUS: ${memo.status.toUpperCase()}`, '', 'CONTENT:', memo.content].join('\n');
    try { await Share.share({ title: `Memo ${memo.id}`, message: text }); } catch (_) { Alert.alert('Share unavailable', text); }
  };

  const publishMemo = async () => {
    if (!isAdmin) { Alert.alert('Admin access required', 'Only Admin, Master, or Manager users can publish memos.'); return; }
    const title = form.title.trim(); const content = form.content.trim();
    if (!title || !content) { Alert.alert('Required fields', 'Memo title and content are required.'); return; }
    const memo = normalizeMemo({
      id: `MEMO-${new Date().getFullYear()}-${String(memos.length + 1).padStart(3, '0')}`,
      title, content, author: user?.NAME || user?.USER || 'User', authorEmail: userEmail,
      date: new Date().toISOString(), priority: form.priority, category: form.category,
      status: 'active', readBy: [], requiresAck: form.requiresAck, tags: [form.category, form.priority],
    }, memos.length);
    setSaving(true);
    try {
      const response = await requestAction('fbWrite', {
        path: `MEMOS/PRIVATE/${memo.id}`, data: JSON.stringify(memo), method: 'PUT',
      });
      if (response.status !== 'success') throw new Error(response.message || 'Failed to publish memo');
      setMemos((current) => [memo, ...current]);
      setForm({ title: '', priority: 'low', category: 'general', requiresAck: false, content: '' });
      setComposeVisible(false);
      Alert.alert('Success', 'Memo published successfully.');
    } catch (e) { Alert.alert('Publish failed', e.message || 'Network error while publishing.'); }
    finally { setSaving(false); }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadMemos(true), tab === 'external' ? loadNews(true) : Promise.resolve()]);
    setRefreshing(false);
  };

  const renderMemoCard = (memo) => {
    const unread = !memo.readBy.includes(userEmail);
    return (
      <TouchableOpacity key={memo.id} style={[styles.memoCard, styles[`border_${memo.priority}`] || styles.border_low]} onPress={() => { setSelectedMemo(memo); markRead(memo); }}>
        <View style={styles.cardTopRow}>
          <View style={styles.cardMain}>
            <View style={styles.titleRow}>{unread ? <View style={styles.unreadDot} /> : null}<Text style={[styles.memoTitle, !unread && styles.readTitle]}>{memo.title}</Text></View>
            <View style={styles.metaRow}><Text style={styles.metaText}>♟ {memo.author}</Text><Text style={styles.metaText}>▣ {formatDate(memo.date)}</Text><Text style={[styles.priorityBadge, styles[`priority_${memo.priority}`] || styles.priority_low]}>{memo.priority.toUpperCase()}</Text></View>
          </View>
          <Text style={styles.memoId}>{memo.id}</Text>
        </View>
        <Text style={styles.preview} numberOfLines={2}>{memo.content}</Text>
        <View style={styles.cardBottomRow}><View style={styles.tags}>{memo.tags.map((tag) => <Text style={styles.tag} key={tag}>{tag}</Text>)}{memo.requiresAck ? <Text style={styles.ackTag}>⚠ ACK</Text> : null}</View><Text style={styles.readMore}>Read More →</Text></View>
      </TouchableOpacity>
    );
  };

  const renderNewsCard = (item) => (
    <View key={item.id} style={[styles.newsCard, styles[`news_${item.sourceType}`] || styles.news_industry]}>
      <Text style={styles.newsTitle}>◉ {item.title}</Text>
      <View style={styles.metaRow}><Text style={styles.metaText}>◎ {item.source}</Text><Text style={styles.metaText}>▣ {formatDate(item.date)}</Text><Text style={[styles.importance, item.importance === 'high' ? styles.highImportance : styles.normalImportance]}>{item.importance.toUpperCase()}</Text></View>
      <Text style={styles.newsContent}>{item.content}</Text>
      <View style={styles.cardBottomRow}><View style={styles.tags}>{item.tags.map((tag) => <Text style={styles.tag} key={tag}>{tag}</Text>)}</View>{item.url ? <TouchableOpacity onPress={() => Linking.openURL(item.url).catch(() => {})}><Text style={styles.sourceLink}>View Source ↗</Text></TouchableOpacity> : null}</View>
    </View>
  );

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
    >
      <View style={styles.container}>
        <View style={styles.hero}>
          <View style={styles.heroCopy}><Text style={styles.heroTitle}>📣 Company Memos & External Updates</Text><Text style={styles.heroSubtitle}>Official company communications, government notifications, and industry news relevant to {appName} operations. Reply to memos via email for official communication.</Text></View>
          <View style={styles.activeBox}><Text style={styles.activeLabel}>Active Memos</Text><Text style={styles.activeValue}>{memos.length}</Text></View>
        </View>

        <View style={styles.tabs}><TouchableOpacity style={[styles.tab, tab === 'internal' && styles.tabActive]} onPress={() => setTab('internal')}><Text style={[styles.tabText, tab === 'internal' && styles.tabTextActive]}>▣ Internal Memos</Text></TouchableOpacity><TouchableOpacity style={[styles.tab, tab === 'external' && styles.tabActive]} onPress={() => setTab('external')}><Text style={[styles.tabText, tab === 'external' && styles.tabTextActive]}>◎ External Updates</Text></TouchableOpacity></View>

        {tab === 'internal' ? (
          <View>
            <View style={styles.controlGrid}>
              <View style={styles.controlCard}>
                <TextInput value={memoSearch} onChangeText={(value) => { setMemoSearch(value); setMemoVisibleCount(10); }} placeholder="Search memos by title, content, or author..." placeholderTextColor="#94a3b8" style={styles.searchInput} returnKeyType="search" />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>{INTERNAL_FILTERS.map(([key, label]) => <Chip key={key} label={label} active={internalFilter === key} onPress={() => { setInternalFilter(key); setMemoVisibleCount(10); }} />)}</ScrollView>
              </View>
              <View style={styles.statsCard}><Text style={styles.sectionTitle}>Memo Statistics</Text><Stat label="This Month" value={thisMonth.length} /><Stat label="Unread" value={unreadMemos.length} color="#1d4ed8" /><Stat label="Requires Action" value={actionRequired.length} color="#dc2626" /></View>
            </View>

            {isAdmin ? <View style={styles.adminBar}><Text style={styles.adminText}>Admin memo controls</Text><TouchableOpacity style={styles.primaryButton} onPress={() => setComposeVisible(true)}><Text style={styles.primaryButtonText}>＋ New Memo</Text></TouchableOpacity></View> : null}
            <View style={styles.sectionHeaderRow}><Text style={styles.sectionTitle}>Recent Company Memos</Text><TouchableOpacity onPress={() => setMemoNewestFirst((value) => !value)}><Text style={styles.sortText}>{memoNewestFirst ? '↓ Newest First' : '↑ Oldest First'}</Text></TouchableOpacity></View>
            {loadingMemos ? <View style={styles.centerState}><ActivityIndicator color={COLORS.primary} size="large" /><Text style={styles.stateText}>Loading company memos...</Text></View> : error ? <View style={styles.errorState}><Text style={styles.errorText}>{error}</Text><TouchableOpacity onPress={() => loadMemos()}><Text style={styles.retryText}>Retry</Text></TouchableOpacity></View> : filteredMemos.length === 0 ? <View style={styles.centerState}><Text style={styles.emptyIcon}>▧</Text><Text style={styles.stateTitle}>No memos found</Text><Text style={styles.stateText}>Try different search terms or check back later.</Text></View> : filteredMemos.slice(0, memoVisibleCount).map(renderMemoCard)}
            {!loadingMemos && filteredMemos.length > memoVisibleCount ? <TouchableOpacity style={styles.loadMoreButton} onPress={() => setMemoVisibleCount((value) => value + 10)}><Text style={styles.loadMoreText}>↓ Load More Memos</Text></TouchableOpacity> : null}
            <View style={styles.replyPanel}><Text style={styles.sectionTitle}>Need to Respond to a Company Memo?</Text><Text style={styles.replyText}>Use your official email to reply to memo authors. The memo reference and title are included in the subject.</Text><Text style={styles.emailCode}>{SUPPORT_EMAIL}</Text></View>
          </View>
        ) : (
          <View>
            <View style={styles.controlGrid}><View style={styles.controlCard}><TextInput value={newsSearch} onChangeText={(value) => { setNewsSearch(value); setNewsVisibleCount(10); }} placeholder="Search external updates..." placeholderTextColor="#94a3b8" style={styles.searchInput} returnKeyType="search" /><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>{NEWS_FILTERS.map(([key, label]) => <Chip key={key} label={label} tone="green" active={newsFilter === key} onPress={() => { setNewsFilter(key); setNewsVisibleCount(10); }} />)}</ScrollView></View><View style={styles.statsCard}><Text style={styles.sectionTitle}>Update Sources</Text><Stat label="Government Portals" value={counts.gov} color="#15803d" /><Stat label="Industry News" value={counts.industry} color="#1d4ed8" /><Stat label="Logistics Updates" value={counts.logistics} color="#d97706" /></View></View>
            <View style={styles.sectionHeaderRow}><Text style={styles.sectionTitle}>Recent External Updates</Text><View style={styles.headerActions}><TouchableOpacity onPress={() => loadNews()}><Text style={styles.sortText}>↻ Refresh</Text></TouchableOpacity><TouchableOpacity onPress={() => setNewsNewestFirst((value) => !value)}><Text style={styles.sortText}>{newsNewestFirst ? '↓ Latest First' : '↑ Oldest First'}</Text></TouchableOpacity><TouchableOpacity onPress={() => setAutoRefresh((value) => !value)}><Text style={styles.sortText}>◷ Auto-refresh: {autoRefresh ? 'ON' : 'OFF'}</Text></TouchableOpacity></View></View>
            {loadingNews ? <View style={styles.centerState}><ActivityIndicator color="#15803d" size="large" /><Text style={styles.stateText}>Loading external updates...</Text></View> : newsError ? <View style={styles.errorState}><Text style={styles.errorText}>{newsError}</Text><TouchableOpacity onPress={() => loadNews()}><Text style={styles.retryText}>Retry</Text></TouchableOpacity></View> : filteredNews.length === 0 ? <View style={styles.centerState}><Text style={styles.emptyIcon}>▤</Text><Text style={styles.stateTitle}>No updates found</Text><Text style={styles.stateText}>Try different search terms or check back later.</Text></View> : filteredNews.slice(0, newsVisibleCount).map(renderNewsCard)}
            {!loadingNews && filteredNews.length > newsVisibleCount ? <TouchableOpacity style={styles.loadMoreButton} onPress={() => setNewsVisibleCount((value) => value + 10)}><Text style={styles.loadMoreText}>↓ Load More Updates</Text></TouchableOpacity> : null}
            <View style={styles.aboutNews}><Text style={styles.sectionTitle}>ⓘ About External Updates</Text><Text style={styles.newsAboutText}>Government sources cover official ministry and portal notifications. Industry news covers shipping, transport, e-commerce, and supply chain developments. Logistics updates cover regulatory, port, customs, and transportation advisories.</Text></View>
          </View>
        )}
      </View>

      <Modal visible={composeVisible} animationType="slide" transparent onRequestClose={() => setComposeVisible(false)}>
        <View style={styles.modalOverlay}><View style={styles.composeModal}><View style={styles.modalHeader}><Text style={styles.modalTitle}>Create New Company Memo</Text><TouchableOpacity onPress={() => setComposeVisible(false)}><Text style={styles.closeText}>✕</Text></TouchableOpacity></View><TextInput value={form.title} onChangeText={(title) => setForm((current) => ({ ...current, title }))} placeholder="Memo title *" placeholderTextColor="#94a3b8" style={styles.formInput} /><Text style={styles.formLabel}>Priority</Text><View style={styles.formOptions}>{['low', 'medium', 'high', 'urgent'].map((value) => <Chip key={value} label={value.toUpperCase()} active={form.priority === value} onPress={() => setForm((current) => ({ ...current, priority: value }))} />)}</View><Text style={styles.formLabel}>Category</Text><View style={styles.formOptions}>{['general', 'policy', 'holiday', 'security', 'system', 'operations'].map((value) => <Chip key={value} label={value} active={form.category === value} onPress={() => setForm((current) => ({ ...current, category: value }))} />)}</View><TouchableOpacity style={styles.ackOption} onPress={() => setForm((current) => ({ ...current, requiresAck: !current.requiresAck }))}><Text style={styles.checkbox}>{form.requiresAck ? '☑' : '☐'}</Text><Text style={styles.formLabel}>Requires acknowledgement</Text></TouchableOpacity><TextInput value={form.content} onChangeText={(content) => setForm((current) => ({ ...current, content }))} placeholder="Memo content *" placeholderTextColor="#94a3b8" style={[styles.formInput, styles.contentInput]} multiline textAlignVertical="top" /><View style={styles.modalActions}><TouchableOpacity style={styles.secondaryButton} onPress={() => setComposeVisible(false)}><Text style={styles.secondaryButtonText}>Cancel</Text></TouchableOpacity><TouchableOpacity style={[styles.primaryButton, saving && styles.disabled]} onPress={publishMemo} disabled={saving}>{saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>✈ Publish Memo</Text>}</TouchableOpacity></View></View></View>
      </Modal>

      <Modal visible={!!selectedMemo} animationType="slide" transparent onRequestClose={() => setSelectedMemo(null)}>
        <View style={styles.modalOverlay}><View style={styles.detailModal}><View style={styles.modalHeader}><View style={styles.cardMain}><Text style={styles.modalTitle}>{selectedMemo?.title}</Text><Text style={styles.metaText}>By {selectedMemo?.author} • {selectedMemo ? formatDateTime(selectedMemo.date) : ''}</Text></View><TouchableOpacity onPress={() => setSelectedMemo(null)}><Text style={styles.closeText}>✕</Text></TouchableOpacity></View><ScrollView style={styles.detailScroll}><Text style={styles.detailContent}>{selectedMemo?.content}</Text><View style={styles.detailGrid}><Stat label="Reference ID" value={selectedMemo?.id} /><Stat label="Priority" value={selectedMemo?.priority?.toUpperCase()} /><Stat label="Category" value={selectedMemo?.category?.toUpperCase()} /><Stat label="Status" value={selectedMemo?.status?.toUpperCase()} /></View>{selectedMemo?.tags?.length ? <View style={styles.tags}>{selectedMemo.tags.map((tag) => <Text style={styles.tag} key={tag}>{tag}</Text>)}</View> : null}</ScrollView><View style={styles.modalActions}><TouchableOpacity style={styles.primaryButton} onPress={() => replyToMemo(selectedMemo)}><Text style={styles.primaryButtonText}>↩ Reply via Email</Text></TouchableOpacity><TouchableOpacity style={styles.secondaryButton} onPress={() => shareMemo(selectedMemo)}><Text style={styles.secondaryButtonText}>⇩ Download/Share</Text></TouchableOpacity>{isAdmin ? <TouchableOpacity style={styles.deleteButton} onPress={() => deleteMemo(selectedMemo)}><Text style={styles.deleteText}>⌫ Delete</Text></TouchableOpacity> : null}</View></View></View>
      </Modal>
    </ScrollView>
  );
}

const shadow = Platform.OS === 'web' ? { boxShadow: '0px 5px 18px rgba(15, 23, 42, 0.10)' } : { shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 9, shadowOffset: { width: 0, height: 3 }, elevation: 3 };
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f8fafc' }, content: { padding: 16, paddingBottom: 36 }, container: { width: '100%', maxWidth: 1160, alignSelf: 'center' },
  hero: { backgroundColor: COLORS.primary, borderRadius: 16, padding: 22, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 14, flexWrap: 'wrap', ...shadow }, heroCopy: { flex: 1, minWidth: 230 }, heroTitle: { color: '#fff', fontFamily: FONTS.extraBold, fontSize: 23, marginBottom: 8 }, heroSubtitle: { color: '#fee2e2', fontFamily: FONTS.body, fontSize: 12, lineHeight: 18, maxWidth: 700 }, activeBox: { backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)', borderRadius: 12, padding: 14, alignItems: 'center', minWidth: 105 }, activeLabel: { color: '#fee2e2', fontSize: 11 }, activeValue: { color: '#fff', fontFamily: FONTS.extraBold, fontSize: 30 },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', marginTop: 16 }, tab: { paddingHorizontal: 18, paddingVertical: 12, borderBottomWidth: 3, borderBottomColor: 'transparent' }, tabActive: { borderBottomColor: COLORS.primary }, tabText: { color: '#64748b', fontFamily: FONTS.semiBold, fontSize: 14 }, tabTextActive: { color: COLORS.primary, fontFamily: FONTS.bold },
  controlGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6, marginTop: 18 }, controlCard: { flexGrow: 2, flexBasis: 480, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', padding: 16, margin: 6, ...shadow }, statsCard: { flexGrow: 1, flexBasis: 240, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', padding: 16, margin: 6, ...shadow }, searchInput: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 9, paddingHorizontal: 12, paddingVertical: 11, color: '#1e293b', fontFamily: FONTS.body, fontSize: 13 }, chipsRow: { gap: 8, paddingTop: 13 }, chip: { borderRadius: 18, backgroundColor: '#f1f5f9', paddingHorizontal: 13, paddingVertical: 8 }, chipActive: { backgroundColor: COLORS.primary }, greenChipActive: { backgroundColor: '#15803d' }, chipText: { color: '#475569', fontFamily: FONTS.semiBold, fontSize: 11 }, chipTextActive: { color: '#fff' }, statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, paddingVertical: 6 }, statLabel: { color: '#64748b', fontFamily: FONTS.body, fontSize: 12, flex: 1 }, statValue: { color: '#1e293b', fontFamily: FONTS.bold, fontSize: 13 },
  adminBar: { marginTop: 14, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, adminText: { color: '#475569', fontFamily: FONTS.semiBold, fontSize: 12 }, sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 22, marginBottom: 10 }, sectionTitle: { color: '#1e293b', fontFamily: FONTS.bold, fontSize: 16 }, sortText: { color: COLORS.primary, fontFamily: FONTS.semiBold, fontSize: 11 }, headerActions: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' },
  memoCard: { backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', borderLeftWidth: 5, padding: 15, marginBottom: 12, ...shadow }, border_low: { borderLeftColor: '#10b981' }, border_medium: { borderLeftColor: COLORS.primary }, border_high: { borderLeftColor: '#d97706' }, border_urgent: { borderLeftColor: '#ef4444' }, cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 }, cardMain: { flex: 1 }, titleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 }, unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2563eb' }, memoTitle: { color: '#1e293b', fontFamily: FONTS.bold, fontSize: 15, flex: 1 }, readTitle: { opacity: 0.9 }, memoId: { color: '#94a3b8', fontFamily: Platform.OS === 'web' ? 'monospace' : undefined, fontSize: 10 }, metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 7 }, metaText: { color: '#64748b', fontFamily: FONTS.body, fontSize: 10 }, priorityBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, overflow: 'hidden', fontFamily: FONTS.bold, fontSize: 9 }, priority_low: { color: '#047857', backgroundColor: '#d1fae5' }, priority_medium: { color: COLORS.primary, backgroundColor: '#fef2f0' }, priority_high: { color: '#b45309', backgroundColor: '#fef3c7' }, priority_urgent: { color: '#b91c1c', backgroundColor: '#fee2e2' }, ackTag: { color: '#b45309', backgroundColor: '#fef3c7', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, fontSize: 9, fontFamily: FONTS.bold }, preview: { color: '#475569', fontFamily: FONTS.body, fontSize: 12, lineHeight: 18, marginTop: 12, marginBottom: 10 }, cardBottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, flex: 1 }, tag: { color: '#64748b', backgroundColor: '#f1f5f9', paddingHorizontal: 7, paddingVertical: 4, borderRadius: 5, fontSize: 9 }, readMore: { color: '#173b70', fontFamily: FONTS.bold, fontSize: 11 },
  newsCard: { backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', borderLeftWidth: 4, padding: 15, marginBottom: 12, ...shadow }, news_gov: { borderLeftColor: '#10b981' }, news_industry: { borderLeftColor: '#8b5cf6' }, news_logistics: { borderLeftColor: '#f59e0b' }, newsTitle: { color: '#1e293b', fontFamily: FONTS.bold, fontSize: 15 }, newsContent: { color: '#475569', fontFamily: FONTS.body, fontSize: 12, lineHeight: 18, marginVertical: 12 }, importance: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5, fontSize: 9, fontFamily: FONTS.bold }, highImportance: { color: '#991b1b', backgroundColor: '#fee2e2' }, normalImportance: { color: '#1d4ed8', backgroundColor: '#dbeafe' }, sourceLink: { color: '#15803d', fontFamily: FONTS.bold, fontSize: 11 },
  centerState: { backgroundColor: '#fff', borderRadius: 12, alignItems: 'center', padding: 40, marginTop: 10, ...shadow }, emptyIcon: { color: '#cbd5e1', fontSize: 42, marginBottom: 8 }, stateTitle: { color: '#334155', fontFamily: FONTS.bold, fontSize: 16 }, stateText: { color: '#64748b', fontFamily: FONTS.body, fontSize: 12, marginTop: 7, textAlign: 'center' }, errorState: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 10, alignItems: 'center', padding: 24, marginTop: 10 }, errorText: { color: '#b91c1c', fontFamily: FONTS.semiBold, fontSize: 12, textAlign: 'center' }, retryText: { color: COLORS.primary, fontFamily: FONTS.bold, fontSize: 12, marginTop: 10 }, loadMoreButton: { alignSelf: 'center', backgroundColor: COLORS.primary, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10, marginVertical: 10 }, loadMoreText: { color: '#fff', fontFamily: FONTS.bold, fontSize: 11 }, replyPanel: { backgroundColor: '#fff7ed', borderWidth: 1, borderColor: '#fed7aa', borderRadius: 12, padding: 16, marginTop: 20 }, replyText: { color: '#475569', fontFamily: FONTS.body, fontSize: 12, lineHeight: 18, marginTop: 6 }, emailCode: { color: '#fff', backgroundColor: COLORS.primary, borderRadius: 7, paddingHorizontal: 10, paddingVertical: 8, alignSelf: 'flex-start', marginTop: 12, fontFamily: Platform.OS === 'web' ? 'monospace' : undefined, fontSize: 11 }, aboutNews: { backgroundColor: '#fff7ed', borderWidth: 1, borderColor: '#fed7aa', borderRadius: 12, padding: 16, marginTop: 18 }, newsAboutText: { color: '#475569', fontFamily: FONTS.body, fontSize: 12, lineHeight: 18, marginTop: 7 },
  primaryButton: { backgroundColor: COLORS.primary, borderRadius: 8, paddingHorizontal: 13, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' }, primaryButtonText: { color: '#fff', fontFamily: FONTS.bold, fontSize: 11 }, secondaryButton: { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 13, paddingVertical: 10 }, secondaryButtonText: { color: '#475569', fontFamily: FONTS.bold, fontSize: 11 }, deleteButton: { backgroundColor: '#fee2e2', borderRadius: 8, paddingHorizontal: 13, paddingVertical: 10 }, deleteText: { color: '#b91c1c', fontFamily: FONTS.bold, fontSize: 11 }, disabled: { opacity: 0.65 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.65)', justifyContent: 'center', padding: 16 }, composeModal: { backgroundColor: '#fff', borderRadius: 15, padding: 18, maxHeight: '92%', ...shadow }, detailModal: { backgroundColor: '#fff', borderRadius: 15, maxHeight: '88%', padding: 18, ...shadow }, modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingBottom: 12, marginBottom: 12, gap: 10 }, modalTitle: { color: '#1e293b', fontFamily: FONTS.bold, fontSize: 18 }, closeText: { color: '#64748b', fontSize: 19, padding: 2 }, formInput: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 11, paddingVertical: 10, color: '#1e293b', fontFamily: FONTS.body, fontSize: 13, marginBottom: 12 }, formLabel: { color: '#475569', fontFamily: FONTS.semiBold, fontSize: 11, marginBottom: 7 }, formOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 12 }, ackOption: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 11 }, checkbox: { color: COLORS.primary, fontSize: 20 }, contentInput: { minHeight: 120 }, modalActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8, marginTop: 12 }, detailScroll: { maxHeight: 420 }, detailContent: { color: '#334155', fontFamily: FONTS.body, fontSize: 14, lineHeight: 21, paddingBottom: 15 }, detailGrid: { borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 10, marginTop: 5, marginBottom: 10 },
});

import { Drawer, Button, Badge, List, Tag, Typography, Space } from 'antd'
import { Bell, CheckCircle, AlertTriangle, Info, XCircle, Trash2, X } from 'lucide-react'
import { useApp } from '../store/AppContext'

interface NotificationPanelProps {
  open: boolean
  onClose: () => void
}

const typeIcon = (type: string) => {
  switch (type) {
    case 'warning': return <AlertTriangle size={16} color="#854d0e" />
    case 'error': return <XCircle size={16} color="#991b1b" />
    case 'success': return <CheckCircle size={16} color="#166534" />
    case 'info':
    default:
      return <Info size={16} color="#1e40af" />
  }
}

const typeBg: Record<string, string> = {
  warning: '#fef9c3', info: '#dbeafe', error: '#fee2e2', success: '#dcfce7'
}
const typeColor: Record<string, string> = {
  warning: '#854d0e', info: '#1e40af', error: '#991b1b', success: '#166534'
}
const typeTagColor: Record<string, string> = {
  warning: 'warning', info: 'processing', error: 'error', success: 'success'
}

export default function NotificationPanel({ open, onClose }: NotificationPanelProps) {
  const { state, markNotificationRead, clearNotifications, t } = useApp()
  const notifications = state.notifications

  const unread = notifications.filter(n => !n.read).length

  const translateNotif = (text: string) => {
    if (state.language === 'gu') return text
    const map: Record<string, string> = {
      'આવક ઉમેરાઈ': 'Income Added',
      'નવી આવક નોંધાઈ': 'New income registered successfully',
      'ખર્ચ ઉમેરાયો': 'Expense Added',
      'નવો ખર્ચ નોંધાયો': 'New expense registered successfully',
      'નાણાકીય વર્ષ સક્રિય': 'Financial Year Active',
      'નવું વર્ષ ચાલુ કરવામાં આવ્યું': 'Active financial year has been switched',
      'બેકઅપ સફળ': 'Backup Successful',
      'ડેટા JSON ફાઇલ તરીકે ડાઉનલોડ થઈ ગઈ': 'Data downloaded successfully as JSON file',
      'પુનઃસ્થાપિત સફળ': 'Restore Successful',
      'ડેટા પુનઃ ઉઘડ્યો': 'Data restored successfully from backup',
    }
    return map[text] || text
  }

  return (
    <Drawer
      title={
        <Space style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <Bell size={18} color="white" />
            <span style={{ color: 'white', fontSize: '0.95rem', fontWeight: 700 }}>{t('notif.title')}</span>
            {unread > 0 && (
              <Badge count={unread} style={{ backgroundColor: '#d4a843', borderColor: '#d4a843' }} />
            )}
          </Space>
          {unread > 0 && (
            <Button
              type="text"
              size="small"
              onClick={() => void clearNotifications()}
              style={{ color: 'rgba(255,255,255,0.8)', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)' }}
            >
              {t('notif.clear_all')}
            </Button>
          )}
        </Space>
      }
      placement="right"
      onClose={onClose}
      open={open}
      width={360}
      styles={{
        header: { background: 'var(--primary)', color: 'white', padding: '16px 20px' },
        body: { padding: 12 },
        footer: { padding: '12px 20px', background: 'var(--muted)', fontSize: '0.75rem', color: 'var(--secondary)', textAlign: 'center' }
      }}
      closeIcon={<X size={18} color="white" />}
      footer={t('notif.footer')}
    >
      {notifications.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--secondary)' }}>
          <Bell size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
          <p style={{ margin: 0, fontSize: '0.9rem' }}>{t('notif.empty')}</p>
        </div>
      ) : (
        <List
          dataSource={notifications}
          renderItem={n => (
            <div
              onClick={() => void markNotificationRead(n.id)}
              style={{
                padding: '12px 14px',
                borderRadius: 10,
                cursor: 'pointer',
                background: n.read ? 'var(--muted)' : typeBg[n.type] || '#f1f5f9',
                border: `1px solid ${n.read ? 'var(--border)' : typeColor[n.type] + '30'}`,
                opacity: n.read ? 0.7 : 1,
                transition: 'all 0.15s',
                marginBottom: 8,
                position: 'relative'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <span style={{ flexShrink: 0, marginTop: 2 }}>
                  {typeIcon(n.type)}
                </span>
                <div style={{ flex: 1 }}>
                  <Typography.Text strong style={{ display: 'block', fontSize: '0.85rem', color: typeColor[n.type] || 'var(--primary)', marginBottom: 2 }}>
                    {translateNotif(n.title)}
                  </Typography.Text>
                  <Typography.Text style={{ display: 'block', fontSize: '0.82rem', color: 'var(--foreground)' }}>
                    {translateNotif(n.message)}
                  </Typography.Text>
                  <Typography.Text style={{ display: 'block', fontSize: '0.72rem', color: 'var(--secondary)', marginTop: 4 }}>
                    {n.createdAt}
                  </Typography.Text>
                </div>
                {!n.read && (
                  <Badge status="processing" style={{ flexShrink: 0, marginTop: 4 }} />
                )}
              </div>
            </div>
          )}
        />
      )}
    </Drawer>
  )
}

import { useState } from 'react'
import { Input, Select, Tag, Card, Typography, Space } from 'antd'
import { Search, Clock, Plus, Edit2, Trash2, BookOpen, Building2, RotateCw, Settings, FileText } from 'lucide-react'
import { useApp } from '../store/AppContext'

export default function AuditLog() {
  const { state, t } = useApp()
  const [search, setSearch] = useState('')
  const [filterEntity, setFilterEntity] = useState('')
  const [filterUser, setFilterUser] = useState('')

  const entities = [...new Set(state.auditLogs.map(l => l.entity))]
  const users = [...new Set(state.auditLogs.map(l => l.user))]

  const filtered = state.auditLogs.filter(log => {
    const matchSearch = log.details.toLowerCase().includes(search.toLowerCase()) || 
      log.action.toLowerCase().includes(search.toLowerCase())
    const matchEntity = filterEntity ? log.entity === filterEntity : true
    const matchUser = filterUser ? log.user === filterUser : true
    return matchSearch && matchEntity && matchUser
  })

  const actionColor: Record<string, string> = {
    'ઉમેર્યો': 'success',
    'સુધાર્યો': 'warning',
    'કાઢ્યો': 'error',
    'ઉઘડ્યો': 'blue',
    'બંધ કર્યો': 'default',
    'સ્ટેટસ': 'purple',
    'ઉઘડ્': 'blue',
  }

  const actionHexColor: Record<string, string> = {
    'ઉમેર્યો': '#16a34a',
    'સુધાર્યો': '#d97706',
    'કાઢ્યો': '#dc2626',
    'ઉઘડ્યો': '#1d4ed8',
    'બંધ કર્યો': '#6b7280',
    'સ્ટેટસ': '#7c3aed',
    'ઉઘડ્': '#1d4ed8',
  }

  const translateAction = (action: string) => {
    if (state.language === 'gu') return action
    const map: Record<string, string> = {
      'ઉમેર્યો': 'Created',
      'સુધાર્યો': 'Updated',
      'કાઢ્યો': 'Deleted',
      'ઉઘડ્યો': 'Opened',
      'બંધ કર્યો': 'Closed',
      'સ્ટેટસ': 'Status Changed',
      'ઉઘડ્': 'Restored',
    }
    return map[action] || action
  }

  const translateEntity = (entity: string) => {
    if (state.language === 'gu') return entity
    const map: Record<string, string> = {
      'આવક': 'Income',
      'ખર્ચ': 'Expense',
      'ચોપડો': 'Year/CashBook',
      'પાર્ટી': 'Party',
      'વ્યવહાર': 'Transaction',
      'વ્યવહારા': 'Transaction',
      'Settings': 'Settings',
    }
    return map[entity] || entity
  }

  const getEntityIcon = (entity: string) => {
    switch (entity) {
      case 'આવક': return <Plus size={16} color="#16a34a" />
      case 'ખર્ચ': return <Trash2 size={16} color="#dc2626" />
      case 'ચોપડો': return <BookOpen size={16} color="#1d4ed8" />
      case 'પાર્ટી': return <Building2 size={16} color="#7c3aed" />
      case 'વ્યવહાર':
      case 'વ્યવહારા': return <RotateCw size={16} color="#0284C7" />
      case 'Settings': return <Settings size={16} color="#6b7280" />
      default: return <FileText size={16} color="#6b7280" />
    }
  }

  return (
    <div>
      <div className="section-header">
        <div>
          <h1 className="section-title">{t('audit.title')}</h1>
          <Typography.Text type="secondary" style={{ fontSize: '0.82rem' }}>
            {filtered.length} {state.language === 'gu' ? 'ઘટના' : 'events'}
          </Typography.Text>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <Input
            placeholder={t('general.search')}
            style={{ width: 200 }}
            value={search}
            onChange={e => setSearch(e.target.value)}
            prefix={<Search size={16} style={{ color: '#9ca3af' }} />}
            allowClear
          />
          <Select
            placeholder={state.language === 'gu' ? 'બધી ઘટના' : 'All Entities'}
            style={{ width: 140 }}
            value={filterEntity || undefined}
            onChange={v => setFilterEntity(v || '')}
            allowClear
            options={entities.map(e => ({ value: e, label: translateEntity(e) }))}
          />
          <Select
            placeholder={state.language === 'gu' ? 'બધા વ્યક્તિ' : 'All Users'}
            style={{ width: 160 }}
            value={filterUser || undefined}
            onChange={v => setFilterUser(v || '')}
            allowClear
            options={users.map(u => ({ value: u, label: u }))}
          />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.length === 0 && (
          <Card style={{ textAlign: 'center', padding: 40 }}>
            <FileText size={32} style={{ color: 'var(--secondary)', opacity: 0.5, marginBottom: 8 }} />
            <p style={{ margin: 0, color: 'var(--secondary)' }}>{t('general.no_data')}</p>
          </Card>
        )}
        {filtered.map(log => (
          <Card
            key={log.id}
            styles={{ body: { padding: '14px 20px' } }}
            style={{ borderLeft: `4px solid ${actionHexColor[log.action] || '#6b7280'}` }}
          >
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: `${actionHexColor[log.action] || '#6b7280'}18`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                paddingTop: 0
              }}>
                {getEntityIcon(log.entity)}
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                  <Typography.Text strong style={{ color: 'var(--primary)', fontSize: '0.9rem' }}>{log.user}</Typography.Text>
                  <Tag color={actionColor[log.action] || 'default'}>
                    {translateAction(log.action)}
                  </Tag>
                  <Typography.Text type="secondary" style={{ fontSize: '0.82rem' }}>{translateEntity(log.entity)}</Typography.Text>
                </div>
                <p style={{ margin: '0 0 4px', fontSize: '0.85rem', color: 'var(--foreground)' }}>{log.details}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--secondary)', fontSize: '0.75rem' }}>
                  <Clock size={12} />
                  <span>{log.timestamp}</span>
                </div>
              </div>

              {log.entityId && (
                <span style={{ fontSize: '0.7rem', color: 'var(--secondary)', flexShrink: 0 }}>
                  ID: {log.entityId.slice(-6)}
                </span>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

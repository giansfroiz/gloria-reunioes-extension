# 🎤 Gloria Reuniões – Extensão Chrome

> Transcreve automaticamente reuniões do **Google Meet**, **Zoom** e **Microsoft Teams** com identificação de falantes, salvando tudo no **Supabase (Gloria Tools)**.

---

## 🛠️ Estrutura do Projeto

```
gloria-reunioes-extension/
├── manifest.json        # Configuração da extensão (Manifest V3)
├── background.js        # Service Worker: captura audio e envia chunks
├── config.js            # Credenciais Supabase + constantes
├── popup.html           # Interface do popup (botões iniciar/parar)
├── popup.js             # Lógica do popup
├── generate-icons.html  # Gerador de ícones PNG (abrir no browser)
└── icons/
    ├── icon.svg           # Ícone fonte
    ├── icon16.png         # Gerado via generate-icons.html
    ├── icon32.png         # Gerado via generate-icons.html
    └── icon128.png        # Gerado via generate-icons.html
```

---

## 🚀 Como instalar (passo a passo)

### 1. Baixar o repositório

```bash
# Clique em Code > Download ZIP  (no GitHub)
# Ou:
git clone https://github.com/giansfroiz/gloria-reunioes-extension.git
```

### 2. Gerar os ícones PNG

1. Abra o arquivo `generate-icons.html` no **Google Chrome**
2. Clique em **"Baixar icon16.png + icon32.png + icon128.png"**
3. Salve os 3 arquivos dentro da pasta `icons/`

### 3. Carregar no Chrome

1. Abra `chrome://extensions`
2. Ative **"Modo do desenvolvedor"** (canto superior direito)
3. Clique em **"Carregar sem compactar"**
4. Selecione a pasta `gloria-reunioes-extension`
5. A extensão aparecerá na barra do Chrome 🎤

---

## 🎧 Como usar

1. Abra uma reunião no **Google Meet**, **Zoom** ou **Teams**
2. Clique no ícone da extensão na barra do Chrome
3. Dê um **título** para a reunião e selecione a **plataforma**
4. Clique em **▶ Iniciar Transcrição**
5. A cada **30 segundos**, um chunk de áudio é enviado para o Whisper (OpenAI)
6. Ao terminar, clique em **⏹ Parar e Salvar**
7. A transcrição completa fica salva no Supabase

---

## 🗄️ Tabelas criadas no Supabase

| Tabela | Conteúdo |
|--------|----------|
| `meetings` | Dados da reunião (título, plataforma, status, transcript completo) |
| `meeting_participants` | Falantes detectados com tempo de fala |
| `meeting_segments` | Cada trecho transcrito com speaker_label, start/end ms |

**Dashboard Supabase:** https://supabase.com/dashboard/project/vwxuqljtqqmevgiwecsf/editor

---

## ⚡ Edge Function

URL: `https://vwxuqljtqqmevgiwecsf.supabase.co/functions/v1/meeting-transcription`

| Action | Método | Descrição |
|--------|--------|----------|
| `?action=start_meeting` | POST JSON | Cria a reunião no banco |
| `?action=transcribe_chunk` | POST FormData (audio + meeting_id + chunk_index) | Transcreve chunk via Whisper |
| `?action=finish_meeting` | POST JSON | Finaliza, monta transcript, calcula tempo de fala |

---

## 🔧 Tecnologias usadas (tudo gratuito)

- **Chrome Extension Manifest V3** – tabCapture + MediaRecorder
- **Supabase Free** – banco de dados + Edge Functions
- **OpenAI Whisper** (`whisper-1`) – transcrição via secret já configurado
- **GitHub** – hospedagem do código

---

## 📖 Ver transcrições

Acesse o **Table Editor** do Supabase:
https://supabase.com/dashboard/project/vwxuqljtqqmevgiwecsf/editor

Ou faça um SELECT:

```sql
SELECT 
  m.title,
  m.started_at,
  mp.speaker_label,
  mp.display_name,
  mp.total_speaking_seconds,
  ms.text,
  ms.start_ms
FROM meeting_segments ms
JOIN meetings m ON m.id = ms.meeting_id
JOIN meeting_participants mp ON mp.id = ms.participant_id
ORDER BY m.started_at DESC, ms.start_ms ASC;
```

---

*Desenvolvido para Gloria Tools – gloriatools.ai*

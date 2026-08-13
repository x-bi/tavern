import { Injectable } from '@nestjs/common';

type QqFriendItem = {
  qqUin: string;
  nickname: string;
  remark: string | null;
  displayName: string;
};

type NapcatEnvelope<T> = {
  status?: string;
  retcode?: number;
  data?: T;
  message?: string;
  wording?: string;
};

@Injectable()
export class QqNapcatClient {
  async getLoginInfo(baseUrl: string, accessToken: string | null) {
    const data = await this.call<{ user_id?: string | number; nickname?: string }>(
      baseUrl,
      accessToken,
      'get_login_info'
    );
    if (data.user_id === undefined) throw new Error('QQ_NAPCAT_RESPONSE_INVALID');
    return { qqUin: String(data.user_id), nickname: data.nickname?.trim() || null };
  }

  async getFriendList(baseUrl: string, accessToken: string | null): Promise<QqFriendItem[]> {
    const data = await this.call<unknown[]>(baseUrl, accessToken, 'get_friend_list');
    if (!Array.isArray(data)) throw new Error('QQ_NAPCAT_RESPONSE_INVALID');
    return data.flatMap((raw) => {
      if (!raw || typeof raw !== 'object') return [];
      const item = raw as { user_id?: unknown; nickname?: unknown; remark?: unknown };
      if (item.user_id === undefined) return [];
      const nickname = typeof item.nickname === 'string' ? item.nickname.trim() : '';
      const remark =
        typeof item.remark === 'string' && item.remark.trim() ? item.remark.trim() : null;
      return [
        {
          qqUin: String(item.user_id),
          nickname: nickname || String(item.user_id),
          remark,
          displayName: remark || nickname || String(item.user_id)
        }
      ];
    });
  }

  async exitBot(baseUrl: string, accessToken: string | null): Promise<void> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/bot_exit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
        },
        body: '{}',
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`NapCat request failed with HTTP ${response.status}.`);
    } catch (error) {
      // bot_exit 可能在 HTTP 响应完成前结束进程；调用前已确认连接在线，此时断连即视为退出成功。
      if (error instanceof Error && error.message.startsWith('NapCat request failed')) throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  async sendPrivateMessage(
    baseUrl: string,
    accessToken: string | null,
    peerQqUin: string,
    text: string
  ): Promise<string | null> {
    const data = await this.call<{ message_id?: string | number }>(
      baseUrl,
      accessToken,
      'send_private_msg',
      {
        user_id: peerQqUin,
        message: [{ type: 'text', data: { text } }]
      }
    );
    return data.message_id === undefined ? null : String(data.message_id);
  }

  private async call<T>(
    baseUrl: string,
    accessToken: string | null,
    action: string,
    params: Record<string, unknown> = {}
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
        },
        body: JSON.stringify(params),
        signal: controller.signal
      });
      const body = (await response.json().catch(() => null)) as NapcatEnvelope<T> | null;
      if (!response.ok || !body || body.status !== 'ok' || body.retcode !== 0) {
        throw new Error(
          body?.message || body?.wording || `NapCat request failed with HTTP ${response.status}.`
        );
      }
      return body.data as T;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('NapCat request timed out.');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}

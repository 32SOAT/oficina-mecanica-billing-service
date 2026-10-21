import { BadRequestException } from '@nestjs/common';
import { ApplicationExceptionFilter } from './application-exception.filter';

describe('ApplicationExceptionFilter', () => {
  function host() {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    return {
      host: {
        switchToHttp: () => ({
          getResponse: () => ({ status }),
        }),
      } as never,
      status,
      json,
    };
  }

  it('serializes an HttpException with an object body', () => {
    const filter = new ApplicationExceptionFilter();
    const http = host();

    filter.catch(new BadRequestException(['campo inválido']), http.host);

    expect(http.status).toHaveBeenCalledWith(400);
    expect(http.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        message: ['campo inválido'],
      }),
    );
  });

  it('serializes an HttpException with a string body', () => {
    const filter = new ApplicationExceptionFilter();
    const http = host();
    const exception = new BadRequestException('falha');
    jest.spyOn(exception, 'getResponse').mockReturnValue('falha');

    filter.catch(exception, http.host);

    expect(http.json).toHaveBeenCalledWith({
      statusCode: 400,
      message: 'falha',
    });
  });

  it('hides unexpected errors behind a generic 500', () => {
    const filter = new ApplicationExceptionFilter();
    const http = host();

    filter.catch(new Error('segredo'), http.host);

    expect(http.status).toHaveBeenCalledWith(500);
    expect(http.json).toHaveBeenCalledWith({
      statusCode: 500,
      message: 'Internal server error',
    });
  });
});
